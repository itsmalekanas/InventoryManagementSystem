package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

func decodeBackupJSON(raw []byte, target any) error {
	if !utf8.Valid(raw) {
		return fmt.Errorf("invalid UTF-8 JSON")
	}
	// Reject duplicate object keys as well as trailing documents and unknown
	// fields. Otherwise silently discarded data could look like a valid import.
	check := json.NewDecoder(bytes.NewReader(raw))
	check.UseNumber()
	var walk func(int) error
	walk = func(depth int) error {
		if depth > 32 {
			return fmt.Errorf("JSON nesting is too deep")
		}
		token, err := check.Token()
		if err != nil {
			return err
		}
		if delimiter, ok := token.(json.Delim); ok {
			switch delimiter {
			case '{':
				seen := map[string]bool{}
				for check.More() {
					key, err := check.Token()
					if err != nil {
						return err
					}
					name, ok := key.(string)
					if !ok || seen[name] {
						return fmt.Errorf("duplicate or invalid JSON key")
					}
					seen[name] = true
					if err := walk(depth + 1); err != nil {
						return err
					}
				}
			case '[':
				for check.More() {
					if err := walk(depth + 1); err != nil {
						return err
					}
				}
			default:
				return fmt.Errorf("invalid JSON delimiter")
			}
			_, err = check.Token()
			return err
		}
		return nil
	}
	if err := walk(0); err != nil {
		return err
	}
	if _, err := check.Token(); err != io.EOF {
		return fmt.Errorf("trailing JSON content")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func readBackup(name, extractTo string) (DB, backupManifest, error) {
	var db DB
	var manifest backupManifest
	reader, err := zip.OpenReader(name)
	if err != nil {
		return db, manifest, fmt.Errorf("invalid ZIP backup: %w", err)
	}
	defer reader.Close()
	info, err := os.Stat(name)
	if err != nil {
		return db, manifest, err
	}
	if info.Size() > maxBackupBytes || len(reader.File) > maxBackupFiles+1 {
		return db, manifest, fmt.Errorf("backup exceeds size or file count limits")
	}
	files := map[string]*zip.File{}
	caseNames := map[string]bool{}
	var expanded uint64
	for _, file := range reader.File {
		if file.Name != "manifest.json" && !backupPathAllowed(file.Name) {
			return db, manifest, fmt.Errorf("unexpected or unsafe backup path: %s", file.Name)
		}
		lower := strings.ToLower(file.Name)
		if caseNames[lower] || !file.Mode().IsRegular() {
			return db, manifest, fmt.Errorf("duplicate or non-regular backup entry: %s", file.Name)
		}
		caseNames[lower] = true
		limit := backupEntryLimit(file.Name)
		if file.Name == "manifest.json" {
			limit = maxManifestBytes
		}
		if file.UncompressedSize64 > uint64(limit) {
			return db, manifest, fmt.Errorf("backup entry exceeds size limit: %s", file.Name)
		}
		expanded += file.UncompressedSize64
		if expanded > uint64(maxExpandedBackup)+uint64(maxManifestBytes) {
			return db, manifest, fmt.Errorf("expanded backup exceeds 4 GiB")
		}
		files[file.Name] = file
	}
	metadata := files["manifest.json"]
	if metadata == nil {
		return db, manifest, fmt.Errorf("not an %s backup: missing manifest", appName)
	}
	source, err := metadata.Open()
	if err != nil {
		return db, manifest, err
	}
	raw, err := io.ReadAll(io.LimitReader(source, maxManifestBytes+1))
	source.Close()
	if err != nil {
		return db, manifest, fmt.Errorf("damaged manifest: %w", err)
	}
	if err := decodeBackupJSON(raw, &manifest); err != nil {
		return db, manifest, fmt.Errorf("invalid manifest: %w", err)
	}
	if manifest.App != appID || manifest.Format != backupFormat {
		return db, manifest, fmt.Errorf("unsupported backup format; use a compatible version of the app")
	}
	if _, err := time.Parse(time.RFC3339, manifest.CreatedAt); err != nil {
		return db, manifest, fmt.Errorf("invalid backup date")
	}
	if len(manifest.Files) < 1 || len(manifest.Files) != len(files)-1 {
		return db, manifest, fmt.Errorf("backup file list does not match the manifest")
	}
	seen := map[string]bool{}
	var database []byte
	for _, entry := range manifest.Files {
		file := files[entry.Path]
		digest, hashErr := hex.DecodeString(entry.SHA256)
		if !backupPathAllowed(entry.Path) || seen[entry.Path] || file == nil || entry.Size < 0 || uint64(entry.Size) != file.UncompressedSize64 || hashErr != nil || len(digest) != sha256.Size {
			return db, manifest, fmt.Errorf("invalid or missing manifest entry: %s", entry.Path)
		}
		seen[entry.Path] = true
		in, err := file.Open()
		if err != nil {
			return db, manifest, err
		}
		hash := sha256.New()
		var data bytes.Buffer
		var head bytes.Buffer
		writers := []io.Writer{hash}
		if entry.Path == "db.json" {
			writers = append(writers, &data)
		}
		if strings.HasPrefix(entry.Path, "images/") {
			writers = append(writers, &limitedHeaderWriter{target: &head})
		}
		var output *os.File
		if extractTo != "" {
			path := filepath.Join(extractTo, filepath.FromSlash(entry.Path))
			if err = os.MkdirAll(filepath.Dir(path), 0o755); err == nil {
				output, err = os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
			}
			if err != nil {
				in.Close()
				return db, manifest, err
			}
			writers = append(writers, output)
		}
		n, copyErr := io.Copy(io.MultiWriter(writers...), io.LimitReader(in, entry.Size+1))
		in.Close()
		if output != nil {
			if copyErr == nil {
				copyErr = output.Sync()
			}
			if closeErr := output.Close(); copyErr == nil {
				copyErr = closeErr
			}
		}
		if copyErr != nil || n != entry.Size || !bytes.Equal(hash.Sum(nil), digest) {
			return db, manifest, fmt.Errorf("damaged or incomplete file: %s", entry.Path)
		}
		if strings.HasPrefix(entry.Path, "images/") {
			if err := validateBackupImage(entry.Path, head.Bytes()); err != nil {
				return db, manifest, err
			}
		}
		if entry.Path == "db.json" {
			database = data.Bytes()
		}
	}
	if !seen["db.json"] {
		return db, manifest, fmt.Errorf("missing database")
	}
	// Defaults are for older compatible databases, not arbitrary missing fields.
	db.Settings = defaultSettings()
	if err := decodeBackupJSON(database, &db); err != nil {
		return db, manifest, fmt.Errorf("invalid database: %w", err)
	}
	if err := validateBackupDB(db, seen); err != nil {
		return db, manifest, err
	}
	normalized := Store{db: db}
	normalized.normalize()
	return normalized.db, manifest, nil
}

type limitedHeaderWriter struct{ target *bytes.Buffer }

func (writer *limitedHeaderWriter) Write(data []byte) (int, error) {
	n := len(data)
	remaining := 512 - writer.target.Len()
	if remaining > 0 {
		if len(data) > remaining {
			data = data[:remaining]
		}
		writer.target.Write(data)
	}
	return n, nil
}

func validateBackupImage(name string, head []byte) error {
	expected := map[string]string{".jpg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}[filepath.Ext(name)]
	if len(head) == 0 || http.DetectContentType(head) != expected {
		return fmt.Errorf("invalid image file: %s", name)
	}
	return nil
}

func verifyStagedBackup(dir string, manifest backupManifest) error {
	for _, entry := range manifest.Files {
		name := filepath.Join(dir, filepath.FromSlash(entry.Path))
		info, err := os.Lstat(name)
		if err != nil || !info.Mode().IsRegular() || info.Size() != entry.Size {
			return fmt.Errorf("staged file is missing or changed: %s", entry.Path)
		}
		file, err := os.Open(name)
		if err != nil {
			return err
		}
		hash := sha256.New()
		_, err = io.Copy(hash, file)
		file.Close()
		if err != nil || hex.EncodeToString(hash.Sum(nil)) != strings.ToLower(entry.SHA256) {
			return fmt.Errorf("staged file checksum mismatch: %s", entry.Path)
		}
	}
	return nil
}

func validateBackupDB(db DB, files map[string]bool) error {
	const safeInteger int64 = 9_007_199_254_740_991
	if db.Version != 1 || db.NextInvoice < 1 || db.NextInvoice > safeInteger {
		return fmt.Errorf("unsupported or invalid database version/counter")
	}
	checkID := func(seen map[string]bool, id string) bool {
		if id == "" || len(id) > 200 || seen[id] {
			return false
		}
		seen[id] = true
		return true
	}
	productIDs, customerIDs, invoiceIDs := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, p := range db.Products {
		if p.CostPrice != nil && (*p.CostPrice < 0 || *p.CostPrice > maxPrice) {
			return fmt.Errorf("invalid product cost: %s", p.ID)
		}
		if !checkID(productIDs, p.ID) || strings.TrimSpace(p.Name) == "" || p.Price < 0 || p.Price > maxPrice || p.Stock < 0 || p.Stock > safeInteger || len(p.Images) > maxImages {
			return fmt.Errorf("invalid product record: %s", p.ID)
		}
		seen := map[string]bool{}
		for _, name := range p.Images {
			if !validImageName(name) || seen[name] || !files["images/"+name] {
				return fmt.Errorf("missing or invalid product image: %s", name)
			}
			seen[name] = true
		}
	}
	for _, c := range db.Customers {
		if !checkID(customerIDs, c.ID) || strings.TrimSpace(c.Name) == "" {
			return fmt.Errorf("invalid customer record: %s", c.ID)
		}
	}
	numbers, codes := map[int64]bool{}, map[string]bool{}
	invoiceCodeByID := map[string]string{}
	for _, inv := range db.Invoices {
		if !checkID(invoiceIDs, inv.ID) || inv.Number < 1 || inv.Number >= db.NextInvoice || numbers[inv.Number] || inv.Year < 1 || inv.Year > 9999 || inv.Seq < 1 || inv.Seq > safeInteger || inv.Code != invoiceCode(inv.Year, inv.Seq) || codes[inv.Code] || db.YearCounters[strconv.Itoa(inv.Year)] < inv.Seq || len(inv.Items) == 0 || len(inv.Items) > maxLines {
			return fmt.Errorf("invalid invoice or numbering: %s", inv.ID)
		}
		if _, err := time.Parse(time.RFC3339, inv.Date); err != nil {
			return fmt.Errorf("invalid invoice date: %s", inv.ID)
		}
		numbers[inv.Number], codes[inv.Code] = true, true
		invoiceCodeByID[inv.ID] = inv.Code
		var total int64
		for _, item := range inv.Items {
			if item.CostPrice != nil && (*item.CostPrice < 0 || *item.CostPrice > maxPrice) {
				return fmt.Errorf("invalid invoice cost: %s", inv.ID)
			}
			if item.Qty < 1 || item.Qty > safeInteger || item.Price < 0 || item.Price > maxPrice || (item.Price > 0 && item.Qty > maxTotal/item.Price) || item.Total != item.Price*item.Qty || strings.TrimSpace(item.Name) == "" {
				return fmt.Errorf("invalid invoice item: %s", inv.ID)
			}
			if item.Total > maxTotal-total {
				return fmt.Errorf("invoice total exceeds supported range: %s", inv.ID)
			}
			total += item.Total
		}
		if total != inv.Total {
			return fmt.Errorf("invoice total mismatch: %s", inv.ID)
		}
		if err := validateInvoiceReturns(inv); err != nil {
			return fmt.Errorf("invalid returns for %s: %w", inv.ID, err)
		}
	}
	for year, counter := range db.YearCounters {
		y, err := strconv.Atoi(year)
		if err != nil || y < 1 || y > 9999 || strconv.Itoa(y) != year || counter < 0 || counter >= safeInteger {
			return fmt.Errorf("invalid yearly invoice counter")
		}
	}
	completed := map[string]bool{}
	for id, receipt := range db.SaleRequests {
		if !saleRequestIDRe.MatchString(id) || !saleRequestHashRe.MatchString(receipt.Hash) {
			return fmt.Errorf("invalid checkout receipt")
		}
		if receipt.Cancelled {
			if receipt.InvoiceID != "" || receipt.Code != "" {
				return fmt.Errorf("invalid cancelled checkout receipt")
			}
			continue
		}
		if !saleInvoiceIDRe.MatchString(receipt.InvoiceID) || completed[receipt.InvoiceID] {
			return fmt.Errorf("invalid duplicate checkout receipt")
		}
		completed[receipt.InvoiceID] = true
		parts := strings.Split(strings.TrimPrefix(receipt.Code, invoicePrefix), "-")
		if len(parts) != 2 {
			return fmt.Errorf("invalid checkout invoice code")
		}
		year, yearErr := strconv.Atoi(parts[0])
		seq, seqErr := strconv.ParseInt(parts[1], 10, 64)
		if yearErr != nil || seqErr != nil || year < 1 || year > 9999 || seq < 1 || receipt.Code != invoiceCode(year, seq) || db.YearCounters[strconv.Itoa(year)] < seq {
			return fmt.Errorf("invalid checkout invoice numbering")
		}
		if code, exists := invoiceCodeByID[receipt.InvoiceID]; exists && code != receipt.Code {
			return fmt.Errorf("checkout receipt does not match invoice")
		}
	}
	s := db.Settings
	if s.Theme != "light" && s.Theme != "dark" {
		return fmt.Errorf("invalid display theme")
	}
	if (s.Language != "en" && s.Language != "ar") || (s.Paper != "a4" && s.Paper != "receipt") || s.LogoSize < 20 || s.LogoSize > 300 || (s.LogoAlign != "start" && s.LogoAlign != "center" && s.LogoAlign != "end") || !colorRe.MatchString(s.AccentColor) || !colorRe.MatchString(s.RowColor) || s.LowStock < 0 || s.LowStock > maxQty {
		return fmt.Errorf("invalid database settings")
	}
	if s.Logo != "" && (!validImageName(s.Logo) || !files["images/"+s.Logo]) {
		return fmt.Errorf("missing store logo")
	}
	return nil
}
