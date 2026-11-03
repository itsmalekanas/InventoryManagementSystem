package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

type transferResponse struct {
	Token          string `json:"token"`
	RecoveryBackup string `json:"recoveryBackup"`
	Generation     string `json:"generation"`
	Error          string `json:"error"`
	DB             DB     `json:"db"`
}

func transferCall(t *testing.T, srv *httptest.Server, method, path string, body []byte, kind, generation string) (int, []byte, transferResponse) {
	t.Helper()
	if generation == "" {
		res, err := http.Get(srv.URL + "/api/data")
		if err != nil {
			t.Fatal(err)
		}
		var current transferResponse
		if err := json.NewDecoder(res.Body).Decode(&current); err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		generation = current.Generation
	}
	req, err := http.NewRequest(method, srv.URL+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", kind)
	req.Header.Set("X-Inventory-Generation", generation)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	var result transferResponse
	if strings.Contains(res.Header.Get("Content-Type"), "json") {
		json.Unmarshal(raw, &result)
	}
	return res.StatusCode, raw, result
}

func exportForTest(t *testing.T, srv *httptest.Server) []byte {
	t.Helper()
	code, raw, result := transferCall(t, srv, "POST", "/api/backups/export", []byte(`{}`), "application/json", "")
	if code != 200 || result.Token == "" {
		t.Fatalf("prepare export: %d %s", code, raw)
	}
	if code, _, _ := transferCall(t, srv, "HEAD", "/api/backups/download/"+result.Token, nil, "", ""); code != 200 {
		t.Fatal("HEAD check failed before downloading backup")
	}
	code, raw, _ = transferCall(t, srv, "GET", "/api/backups/download/"+result.Token, nil, "", "")
	if code != 200 {
		t.Fatalf("download: %d %s", code, raw)
	}
	return raw
}

func previewForTest(t *testing.T, srv *httptest.Server, archive []byte) transferResponse {
	t.Helper()
	code, raw, result := transferCall(t, srv, "POST", "/api/backups/import/preview", archive, "application/zip", "")
	if code != 200 || result.Token == "" {
		t.Fatalf("preview: %d %s", code, raw)
	}
	return result
}

func commitForTest(t *testing.T, srv *httptest.Server, token string) (int, []byte, transferResponse) {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"token": token})
	return transferCall(t, srv, "POST", "/api/backups/import/commit", body, "application/json", "")
}

func populateBackupSource(t *testing.T) (*httptest.Server, *Store, string) {
	t.Helper()
	srv, store, dir := newTestServer(t)
	t.Cleanup(store.cleanupTransfers)
	var picture bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	if err := png.Encode(&picture, img); err != nil {
		t.Fatal(err)
	}
	_, uploaded := call(t, srv, "POST", "/api/images", picture.Bytes())
	_, logo := call(t, srv, "POST", "/api/images", picture.Bytes())
	_, result := call(t, srv, "POST", "/api/products", Product{Name: "عطر ورد", Price: 25000, Stock: 20, Images: []string{uploaded.Name}})
	pid := result.DB.Products[0].ID
	year := time.Now().Year()
	for _, seq := range []int{500, 501} {
		code, p := call(t, srv, "POST", "/api/sales", map[string]any{
			"invoiceNumber": seq, "invoiceYear": year,
			"customer": map[string]string{"name": "أحمد علي", "phone": "٠٧٧٠١٢٣٤٥٦٧", "address": "بغداد - الكرادة"},
			"items":    []map[string]any{{"productId": pid, "qty": 2}},
		})
		if code != 200 {
			t.Fatalf("source sale: %d %s", code, p.Error)
		}
		result = p
	}
	call(t, srv, "DELETE", "/api/invoices/"+result.DB.Invoices[1].ID, nil)
	product := result.DB.Products[0]
	product.Name, product.Price = "عطر ورد جديد", 30000
	call(t, srv, "POST", "/api/products", product)
	settings := defaultSettings()
	settings.Theme = "dark"
	settings.Language, settings.StoreName, settings.Logo = "ar", "متجر الورد", logo.Name
	settings.Header, settings.Footer, settings.AccentColor, settings.LogoAlign = "بغداد\n0770 123 4567", "شكراً لزيارتكم", "#123456", "end"
	call(t, srv, "PUT", "/api/settings", settings)
	return srv, store, dir
}

func directoryFiles(t *testing.T, dir string) map[string]string {
	t.Helper()
	files := map[string]string{}
	err := filepath.WalkDir(dir, func(name string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		raw, err := os.ReadFile(name)
		if err != nil {
			return err
		}
		relative, _ := filepath.Rel(dir, name)
		files[filepath.ToSlash(relative)] = string(raw)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return files
}

func TestBackupFullTransferAndRecovery(t *testing.T) {
	source, original, sourceDir := populateBackupSource(t)
	archive := exportForTest(t, source)
	destination, restored, destDir := newTestServer(t)
	t.Cleanup(restored.cleanupTransfers)
	call(t, destination, "POST", "/api/products", Product{Name: "Destination old product", Price: 1, Stock: 8})
	before := restored.db
	oldGeneration := restored.generation
	preview := previewForTest(t, destination, archive)
	if !reflect.DeepEqual(before, restored.db) {
		t.Fatal("preview changed live data")
	}
	code, raw, result := commitForTest(t, destination, preview.Token)
	if code != 200 {
		t.Fatalf("commit: %d %s", code, raw)
	}
	if result.Generation == oldGeneration {
		t.Fatal("restore did not invalidate stale clients")
	}
	if !reflect.DeepEqual(original.db, result.DB) {
		t.Fatal("restored database differs from source")
	}
	if !reflect.DeepEqual(directoryFiles(t, sourceDir), directoryFiles(t, destDir)) {
		t.Fatal("restored database/images/backups are not byte-for-byte equal")
	}
	recovery, _, err := readBackup(result.RecoveryBackup, "")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, recovery) {
		t.Fatal("recovery archive does not preserve replaced destination")
	}
	reopened, err := OpenStore(destDir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(original.db, reopened.db) {
		t.Fatal("restored data changed after restart")
	}
	if original.db.YearCounters[fmt.Sprint(time.Now().Year())] != 501 || result.DB.Invoices[0].Items[0].Price != 25000 {
		t.Fatal("numbering/history fixture was not preserved")
	}
	// Exporting again from the destination must reproduce the same data files.
	archive2 := exportForTest(t, destination)
	entries1, entries2 := zipContents(t, archive), zipContents(t, archive2)
	delete(entries1, "manifest.json")
	delete(entries2, "manifest.json")
	if !reflect.DeepEqual(entries1, entries2) {
		t.Fatal("re-export changed transferred data")
	}
	code, _, result = transferCall(t, destination, "POST", "/api/products", []byte(`{"name":"stale write","price":1,"stock":1}`), "application/json", oldGeneration)
	if code != 409 || result.Error != "err.dataReplaced" {
		t.Fatal("stale browser was allowed to overwrite imported data")
	}
	// A pre-import safety ZIP is itself a normal, importable backup.
	third, _, _ := newTestServer(t)
	var committed transferResponse
	json.Unmarshal(raw, &committed)
	safety, err := os.ReadFile(committed.RecoveryBackup)
	if err != nil {
		t.Fatal(err)
	}
	safetyPreview := previewForTest(t, third, safety)
	code, raw, result = commitForTest(t, third, safetyPreview.Token)
	if code != 200 || !reflect.DeepEqual(before, result.DB) {
		t.Fatalf("recovery restore failed: %d %s", code, raw)
	}
}

func zipContents(t *testing.T, data []byte) map[string][]byte {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	result := map[string][]byte{}
	for _, entry := range reader.File {
		file, err := entry.Open()
		if err != nil {
			t.Fatal(err)
		}
		raw, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			t.Fatal(err)
		}
		result[entry.Name] = raw
	}
	return result
}

func makeTestArchive(t *testing.T, entries map[string][]byte, sign bool) []byte {
	t.Helper()
	if sign {
		manifest := backupManifest{App: appID, Format: backupFormat, CreatedAt: time.Now().UTC().Format(time.RFC3339)}
		for name, raw := range entries {
			if name == "manifest.json" {
				continue
			}
			hash := sha256.Sum256(raw)
			manifest.Files = append(manifest.Files, backupEntry{Path: name, Size: int64(len(raw)), SHA256: hex.EncodeToString(hash[:])})
		}
		raw, _ := json.Marshal(manifest)
		entries["manifest.json"] = raw
	}
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, raw := range entries {
		file, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write(raw); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestBackupRejectsCorruptionAndUnsafeArchives(t *testing.T) {
	source, _, _ := populateBackupSource(t)
	archive := exportForTest(t, source)
	tests := []struct {
		name   string
		change func(map[string][]byte)
		sign   bool
	}{
		{"checksum mismatch", func(files map[string][]byte) { files["db.json"] = append(files["db.json"], ' ') }, false},
		{"missing file", func(files map[string][]byte) {
			for name := range files {
				if strings.HasPrefix(name, "images/") {
					delete(files, name)
					break
				}
			}
		}, false},
		{"path traversal", func(files map[string][]byte) { files["../outside.txt"] = []byte("escape") }, true},
		{"absolute path", func(files map[string][]byte) { files["/outside.txt"] = []byte("escape") }, true},
		{"Windows path", func(files map[string][]byte) { files[`images\..\outside.txt`] = []byte("escape") }, true},
		{"unlisted file", func(files map[string][]byte) { files["backups/db-2000-01-01.json"] = []byte(`{}`) }, false},
		{"future format", func(files map[string][]byte) {
			var m backupManifest
			json.Unmarshal(files["manifest.json"], &m)
			m.Format++
			files["manifest.json"], _ = json.Marshal(m)
		}, false},
		{"future database", func(files map[string][]byte) {
			files["db.json"] = bytes.Replace(files["db.json"], []byte(`"version": 1`), []byte(`"version": 2`), 1)
		}, true},
		{"unknown data field", func(files map[string][]byte) {
			files["db.json"] = bytes.Replace(files["db.json"], []byte(`"version": 1`), []byte(`"version": 1, "unknownFutureData": 5`), 1)
		}, true},
		{"duplicate JSON key", func(files map[string][]byte) {
			files["db.json"] = bytes.Replace(files["db.json"], []byte(`"version": 1`), []byte(`"version": 1, "version": 1`), 1)
		}, true},
		{"trailing JSON", func(files map[string][]byte) { files["db.json"] = append(files["db.json"], []byte(` {}`)...) }, true},
		{"negative stock", func(files map[string][]byte) {
			var db DB
			json.Unmarshal(files["db.json"], &db)
			db.Products[0].Stock = -1
			files["db.json"], _ = json.Marshal(db)
		}, true},
		{"duplicate product ID", func(files map[string][]byte) {
			var db DB
			json.Unmarshal(files["db.json"], &db)
			db.Products = append(db.Products, db.Products[0])
			files["db.json"], _ = json.Marshal(db)
		}, true},
		{"wrong invoice total", func(files map[string][]byte) {
			var db DB
			json.Unmarshal(files["db.json"], &db)
			db.Invoices[0].Total++
			files["db.json"], _ = json.Marshal(db)
		}, true},
		{"rewound counter", func(files map[string][]byte) {
			var db DB
			json.Unmarshal(files["db.json"], &db)
			db.YearCounters[fmt.Sprint(time.Now().Year())] = 0
			files["db.json"], _ = json.Marshal(db)
		}, true},
		{"missing image reference", func(files map[string][]byte) {
			var db DB
			json.Unmarshal(files["db.json"], &db)
			db.Products[0].Images = []string{"ffffffffffffffff.png"}
			files["db.json"], _ = json.Marshal(db)
		}, true},
		{"invalid image", func(files map[string][]byte) {
			for name := range files {
				if strings.HasPrefix(name, "images/") {
					files[name] = []byte("not an image")
					break
				}
			}
		}, true},
		{"oversized compressed image", func(files map[string][]byte) { files["images/ffffffffffffffff.png"] = make([]byte, 16<<20) }, true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			destination, store, dir := newTestServer(t)
			t.Cleanup(store.cleanupTransfers)
			before := directoryFiles(t, dir)
			files := zipContents(t, archive)
			test.change(files)
			code, raw, _ := transferCall(t, destination, "POST", "/api/backups/import/preview", makeTestArchive(t, files, test.sign), "application/zip", "")
			if code == 200 {
				t.Fatalf("invalid backup accepted: %s", raw)
			}
			if !reflect.DeepEqual(before, directoryFiles(t, dir)) {
				t.Fatal("rejected backup changed live data")
			}
			if len(store.transfers) != 0 {
				t.Fatal("failed validation retained a transfer")
			}
		})
	}
	for _, data := range [][]byte{[]byte("not a zip"), archive[:len(archive)/2]} {
		destination, store, _ := newTestServer(t)
		t.Cleanup(store.cleanupTransfers)
		if code, _, _ := transferCall(t, destination, "POST", "/api/backups/import/preview", data, "application/zip", ""); code == 200 {
			t.Fatal("truncated/non-ZIP accepted")
		}
	}
}

func TestBackupPreviewConcurrencyAndStagingDamage(t *testing.T) {
	source, _, _ := populateBackupSource(t)
	archive := exportForTest(t, source)
	for _, scenario := range []string{"changed destination", "damaged staging", "cancelled", "expired", "recovery write failure"} {
		t.Run(scenario, func(t *testing.T) {
			srv, s, dir := newTestServer(t)
			t.Cleanup(s.cleanupTransfers)
			preview := previewForTest(t, srv, archive)
			switch scenario {
			case "changed destination":
				call(t, srv, "POST", "/api/products", Product{Name: "New sale data", Price: 10, Stock: 10})
			case "damaged staging":
				if err := os.WriteFile(filepath.Join(s.transfers[preview.Token].path, "db.json"), []byte(`{}`), 0o600); err != nil {
					t.Fatal(err)
				}
			case "cancelled":
				transferCall(t, srv, "DELETE", "/api/backups/import/"+preview.Token, nil, "application/json", "")
			case "expired":
				s.mu.Lock()
				s.transfers[preview.Token].expires = time.Now().Add(-time.Second)
				s.mu.Unlock()
			case "recovery write failure":
				if err := os.WriteFile(filepath.Join(filepath.Dir(dir), filepath.Base(dir)+"-recovery"), []byte("blocked"), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			before := directoryFiles(t, dir)
			code, raw, _ := commitForTest(t, srv, preview.Token)
			if code == 200 {
				t.Fatalf("invalid commit succeeded: %s", raw)
			}
			if !reflect.DeepEqual(before, directoryFiles(t, dir)) {
				t.Fatal("failed commit changed live files")
			}
		})
	}
}

func TestBackupRejectsDuplicateAndSymlinkZIPEntries(t *testing.T) {
	for _, mode := range []string{"duplicate", "symlink"} {
		t.Run(mode, func(t *testing.T) {
			var buffer bytes.Buffer
			writer := zip.NewWriter(&buffer)
			if mode == "duplicate" {
				for i := 0; i < 2; i++ {
					entry, _ := writer.Create("db.json")
					entry.Write([]byte(`{}`))
				}
			} else {
				header := &zip.FileHeader{Name: "images/ffffffffffffffff.png"}
				header.SetMode(os.ModeSymlink | 0o777)
				entry, _ := writer.CreateHeader(header)
				entry.Write([]byte("../../outside"))
			}
			writer.Close()
			srv, s, _ := newTestServer(t)
			t.Cleanup(s.cleanupTransfers)
			if code, _, _ := transferCall(t, srv, "POST", "/api/backups/import/preview", buffer.Bytes(), "application/zip", ""); code == 200 {
				t.Fatal("unsafe ZIP accepted")
			}
		})
	}
}

func TestExportRefusesMissingReferencedImages(t *testing.T) {
	srv, s, _ := populateBackupSource(t)
	if err := os.Remove(filepath.Join(s.imagesDir, s.db.Products[0].Images[0])); err != nil {
		t.Fatal(err)
	}
	if code, _, _ := transferCall(t, srv, "POST", "/api/backups/export", []byte(`{}`), "application/json", ""); code == 200 {
		t.Fatal("incomplete backup offered for download")
	}
}

func TestTransferPreservesInvoicesForDeletedProductsAndCustomers(t *testing.T) {
	source, s, _ := populateBackupSource(t)
	invoice := s.db.Invoices[0]
	call(t, source, "DELETE", "/api/products/"+s.db.Products[0].ID, nil)
	call(t, source, "DELETE", "/api/customers/"+s.db.Customers[0].ID, nil)
	archive := exportForTest(t, source)
	destination, store, _ := newTestServer(t)
	t.Cleanup(store.cleanupTransfers)
	preview := previewForTest(t, destination, archive)
	code, raw, result := commitForTest(t, destination, preview.Token)
	if code != 200 || !reflect.DeepEqual(result.DB.Invoices[0], invoice) || len(result.DB.Products) != 0 || len(result.DB.Customers) != 0 {
		t.Fatalf("historical invoice transfer failed: %d %s", code, raw)
	}
}

func TestBackupFromBeforeOptionalSettingsAndCheckoutReceipts(t *testing.T) {
	source, original, _ := populateBackupSource(t)
	entries := zipContents(t, exportForTest(t, source))
	var legacy map[string]any
	if err := json.Unmarshal(entries["db.json"], &legacy); err != nil {
		t.Fatal(err)
	}
	delete(legacy["settings"].(map[string]any), "theme")
	delete(legacy["settings"].(map[string]any), "showDate")
	delete(legacy["settings"].(map[string]any), "showTime")
	delete(legacy, "saleRequests")
	entries["db.json"], _ = json.Marshal(legacy)
	destination, store, _ := newTestServer(t)
	t.Cleanup(store.cleanupTransfers)
	preview := previewForTest(t, destination, makeTestArchive(t, entries, true))
	code, raw, result := commitForTest(t, destination, preview.Token)
	expected := original.db
	expected.Settings.Theme = "light"
	expected.SaleRequests = nil
	if code != 200 || !reflect.DeepEqual(expected, result.DB) {
		t.Fatalf("legacy backup lost compatibility: %d %s", code, raw)
	}
}
