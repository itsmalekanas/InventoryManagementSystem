package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// apiError carries a message key that the browser translates (see app.js).
type apiError struct {
	Status int
	Key    string
}

func (e *apiError) Error() string { return e.Key }

func bad(key string) error { return &apiError{http.StatusBadRequest, key} }

func notFound() error { return &apiError{http.StatusNotFound, "err.notFound"} }

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func now() string { return time.Now().Format(time.RFC3339) }

// cleanText trims a value, removes control characters (keeping new lines
// when allowed) and limits its length. Arabic and any other script pass
// through untouched because everything is UTF-8.
func cleanText(v string, max int, multiline bool) string {
	if !utf8.ValidString(v) {
		v = strings.ToValidUTF8(v, "")
	}
	v = strings.ReplaceAll(v, "\r\n", "\n")
	v = strings.Map(func(r rune) rune {
		if r == '\n' && multiline {
			return r
		}
		if r < 32 || r == 127 {
			if r == '\t' || r == '\n' {
				return ' '
			}
			return -1
		}
		return r
	}, v)
	v = strings.TrimSpace(v)
	if utf8.RuneCountInString(v) > max {
		v = string([]rune(v)[:max])
	}
	return v
}

// normalizePhone turns Arabic-Indic (٠١٢...) and Persian (۰۱۲...) digits
// into 0-9 and keeps only digits and a leading +, so the same phone number
// typed on an Arabic or English keyboard matches the same customer.
func normalizePhone(v string) string {
	var b strings.Builder
	for i, r := range strings.TrimSpace(v) {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r >= '٠' && r <= '٩':
			b.WriteRune('0' + (r - '٠'))
		case r >= '۰' && r <= '۹':
			b.WriteRune('0' + (r - '۰'))
		case r == '+' && i == 0:
			b.WriteRune(r)
		}
	}
	return b.String()
}

var imageNameRe = regexp.MustCompile(`^[0-9a-f]{16}\.(jpg|png|webp|gif)$`)

var colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func validImageName(n string) bool { return imageNameRe.MatchString(n) }

func readJSON(r *http.Request, v any) error {
	// Requiring JSON means a web page on another site cannot send data here
	// with a plain form post: the browser would ask first and be refused.
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return bad("err.badRequest")
	}
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 2<<20))
	var raw json.RawMessage
	if err := dec.Decode(&raw); err != nil {
		return bad("err.badRequest")
	}
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || raw[0] != '{' {
		return bad("err.badRequest")
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return bad("err.badRequest")
	}
	if err := json.Unmarshal(raw, v); err != nil {
		return bad("err.badRequest")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// mutate runs fn under the lock, saves the database and answers with the
// whole database so the page always shows exactly what is on disk.
// If fn fails, the in-memory copy is restored so nothing half done stays.
func (s *Store) mutate(w http.ResponseWriter, r *http.Request, fn func(db *DB) error) {
	s.mutateWithOutcome(w, r, fn, nil)
}

type mutationOutcome struct {
	replay bool
	fields map[string]any
}

func (s *Store) mutateWithOutcome(w http.ResponseWriter, r *http.Request, fn func(db *DB) error, outcome *mutationOutcome) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.checkGenerationLocked(r); err != nil {
		backupError(w, err)
		return
	}
	backup, _ := json.Marshal(s.db)
	if err := fn(&s.db); err != nil {
		s.db = DB{}
		json.Unmarshal(backup, &s.db)
		s.normalize()
		var ae *apiError
		if errors.As(err, &ae) {
			writeJSON(w, ae.Status, map[string]string{"error": ae.Key})
		} else {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "err.server", "detail": err.Error()})
		}
		return
	}
	if outcome != nil && outcome.replay {
		result := s.payloadLocked()
		for key, value := range outcome.fields {
			result[key] = value
		}
		writeJSON(w, http.StatusOK, result)
		return
	}
	if err := s.saveLocked(); err != nil {
		s.db = DB{}
		json.Unmarshal(backup, &s.db)
		s.normalize()
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "err.save", "detail": err.Error()})
		return
	}
	s.revision++
	result := s.payloadLocked()
	if outcome != nil {
		for key, value := range outcome.fields {
			result[key] = value
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Store) payloadLocked() map[string]any {
	abs, _ := filepath.Abs(s.dir)
	year := time.Now().Year()
	return map[string]any{"db": s.db, "dataDir": abs, "generation": s.generation, "version": appVersion, "numbering": map[string]any{
		"year": year, "nextNumber": s.db.YearCounters[fmt.Sprint(year)] + 1,
	}}
}

func (s *Store) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, r *http.Request) {
		build, err := currentBuildID()
		if err != nil {
			backupError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, instanceIdentity{App: appID, DataDir: s.dir, BuildID: build, Version: appVersion})
	})

	mux.HandleFunc("GET /api/data", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.importBroken {
			backupError(w, &apiError{http.StatusServiceUnavailable, "err.importRecovery"})
			return
		}
		writeJSON(w, http.StatusOK, s.payloadLocked())
	})

	mux.HandleFunc("POST /api/products", s.saveProduct)
	mux.HandleFunc("DELETE /api/products/{id}", s.deleteProduct)
	mux.HandleFunc("POST /api/customers", s.saveCustomer)
	mux.HandleFunc("DELETE /api/customers/{id}", s.deleteCustomer)
	mux.HandleFunc("POST /api/sales", s.createSale)
	mux.HandleFunc("POST /api/sales/cancel", s.cancelSaleAttempt)
	mux.HandleFunc("GET /api/sales/requests/{id}", s.saleAttemptStatus)
	mux.HandleFunc("DELETE /api/invoices/{id}", s.deleteInvoice)
	mux.HandleFunc("POST /api/invoices/{id}/returns", s.returnInvoice)
	mux.HandleFunc("PUT /api/settings", s.saveSettings)
	mux.HandleFunc("POST /api/images", s.uploadImage)
	s.backupRoutes(mux)

	mux.HandleFunc("GET /images/{name}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if !validImageName(name) {
			http.NotFound(w, r)
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(s.imagesDir, name))
	})
}

func (s *Store) saveProduct(w http.ResponseWriter, r *http.Request) {
	var in Product
	if err := readJSON(r, &in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badRequest"})
		return
	}
	var removed []string
	s.mutate(w, r, func(db *DB) error {
		in.Name = cleanText(in.Name, 200, false)
		if in.Name == "" {
			return bad("err.nameRequired")
		}
		if in.Price < 0 || in.Price > maxPrice {
			return bad("err.badPrice")
		}
		if in.CostPrice != nil && (*in.CostPrice < 0 || *in.CostPrice > maxPrice) {
			return bad("err.badCost")
		}
		if in.Stock < 0 || in.Stock > maxQty {
			return bad("err.badStock")
		}
		imgs := []string{}
		seen := map[string]bool{}
		for _, img := range in.Images {
			if validImageName(img) && !seen[img] && len(imgs) < maxImages {
				seen[img] = true
				imgs = append(imgs, img)
			}
		}
		in.Images = imgs

		if in.ID == "" {
			in.ID = newID()
			in.CreatedAt = now()
			in.UpdatedAt = in.CreatedAt
			db.Products = append(db.Products, in)
			return nil
		}
		for i := range db.Products {
			if db.Products[i].ID == in.ID {
				for _, old := range db.Products[i].Images {
					if !seen[old] {
						removed = append(removed, old)
					}
				}
				in.CreatedAt = db.Products[i].CreatedAt
				in.UpdatedAt = now()
				db.Products[i] = in
				return nil
			}
		}
		return notFound()
	})
	s.mu.Lock()
	if r.Header.Get("X-Inventory-Generation") == s.generation {
		s.removeImagesIfUnused(removed)
	}
	s.mu.Unlock()
}

func (s *Store) deleteProduct(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var removed []string
	s.mutate(w, r, func(db *DB) error {
		for i, p := range db.Products {
			if p.ID == id {
				removed = p.Images
				db.Products = append(db.Products[:i], db.Products[i+1:]...)
				return nil
			}
		}
		return notFound()
	})
	s.mu.Lock()
	if r.Header.Get("X-Inventory-Generation") == s.generation {
		s.removeImagesIfUnused(removed)
	}
	s.mu.Unlock()
}

func (s *Store) saveCustomer(w http.ResponseWriter, r *http.Request) {
	var in Customer
	if err := readJSON(r, &in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badRequest"})
		return
	}
	s.mutate(w, r, func(db *DB) error {
		in.Name = cleanText(in.Name, 200, false)
		in.Phone = cleanText(in.Phone, 40, false)
		in.Address = cleanText(in.Address, 500, true)
		if in.Name == "" {
			return bad("err.nameRequired")
		}
		if p := normalizePhone(in.Phone); p != "" {
			for _, c := range db.Customers {
				if c.ID != in.ID && normalizePhone(c.Phone) == p {
					return bad("err.phoneTaken")
				}
			}
		}
		if in.ID == "" {
			in.ID = newID()
			in.CreatedAt = now()
			db.Customers = append(db.Customers, in)
			return nil
		}
		for i := range db.Customers {
			if db.Customers[i].ID == in.ID {
				in.CreatedAt = db.Customers[i].CreatedAt
				db.Customers[i] = in
				return nil
			}
		}
		return notFound()
	})
}

func (s *Store) deleteCustomer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.mutate(w, r, func(db *DB) error {
		for i, c := range db.Customers {
			if c.ID == id {
				// Invoices keep their own copy of the customer details,
				// so they stay correct after the customer is removed.
				db.Customers = append(db.Customers[:i], db.Customers[i+1:]...)
				return nil
			}
		}
		return notFound()
	})
}

type saleRequest struct {
	RequestID     string `json:"requestId"`
	InvoiceNumber *int64 `json:"invoiceNumber"`
	InvoiceYear   int    `json:"invoiceYear"`
	Customer      struct {
		Name    string `json:"name"`
		Phone   string `json:"phone"`
		Address string `json:"address"`
	} `json:"customer"`
	Items []struct {
		ProductID   string `json:"productId"`
		Qty         int64  `json:"qty"`
		CustomPrice *int64 `json:"customPrice,omitempty"`
	} `json:"items"`
}

// createSale is the only place that changes stock for a sale. Prices and
// totals are calculated here using the saved price or a validated unit override.
func (s *Store) createSale(w http.ResponseWriter, r *http.Request) {
	var in saleRequest
	if err := readJSON(r, &in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badRequest"})
		return
	}
	if !saleRequestIDRe.MatchString(in.RequestID) {
		backupError(w, bad("err.saleRequest"))
		return
	}
	hash := saleRequestHash(in)
	outcome := &mutationOutcome{fields: map[string]any{}}
	s.mutateWithOutcome(w, r, func(db *DB) error {
		if receipt, ok := db.SaleRequests[in.RequestID]; ok {
			if receipt.Hash != hash {
				return &apiError{http.StatusConflict, "err.saleRequestChanged"}
			}
			if receipt.Cancelled {
				return &apiError{http.StatusConflict, "err.saleCancelled"}
			}
			if saleInvoiceExists(db, receipt.InvoiceID) {
				outcome.replay = true
				outcome.fields["invoiceId"] = receipt.InvoiceID
				return nil
			}
			return &apiError{http.StatusConflict, "err.saleDeleted"}
		}
		name := cleanText(in.Customer.Name, 200, false)
		phone := cleanText(in.Customer.Phone, 40, false)
		address := cleanText(in.Customer.Address, 500, true)
		if name == "" {
			return bad("err.customerRequired")
		}
		if len(in.Items) == 0 {
			return bad("err.cartEmpty")
		}
		if len(in.Items) > maxLines {
			return bad("err.badRequest")
		}

		// Merge matching product/price lines while checking stock across all prices.
		type saleLine struct {
			productID string
			price     int64
		}
		qty := map[saleLine]int64{}
		stockQty := map[string]int64{}
		order := []saleLine{}
		index := map[string]int{}
		for i, p := range db.Products {
			index[p.ID] = i
		}
		for _, it := range in.Items {
			if it.Qty < 1 || it.Qty > maxQty {
				return bad("err.badQty")
			}
			i, ok := index[it.ProductID]
			if !ok {
				return bad("err.productGone")
			}
			price := db.Products[i].Price
			if it.CustomPrice != nil {
				price = *it.CustomPrice
				if price < 0 || price > maxPrice {
					return bad("err.badPrice")
				}
			}
			key := saleLine{it.ProductID, price}
			if _, ok := qty[key]; !ok {
				order = append(order, key)
			}
			qty[key] += it.Qty
			stockQty[it.ProductID] += it.Qty
		}
		for pid, q := range stockQty {
			if q > db.Products[index[pid]].Stock {
				return &apiError{http.StatusConflict, "err.notEnoughStock"}
			}
		}
		when := time.Now()
		if in.InvoiceNumber != nil {
			if in.InvoiceYear != when.Year() {
				return &apiError{http.StatusConflict, "err.invoiceYearChanged"}
			}
			if err := db.setNextInvoiceNumber(when.Year(), *in.InvoiceNumber); err != nil {
				return err
			}
		}
		if db.YearCounters[fmt.Sprint(when.Year())] >= maxInvoiceSequence {
			return bad("err.invoiceNumber")
		}
		inv := Invoice{ID: newID(), Number: db.NextInvoice, Date: when.Format(time.RFC3339), Items: []InvoiceItem{}}
		// Taken here; if the sale is refused below, mutate rolls it back.
		inv.Code, inv.Year, inv.Seq = db.nextCode(when)
		for _, key := range order {
			i, ok := index[key.productID]
			if !ok {
				return bad("err.productGone")
			}
			p := &db.Products[i]
			q := qty[key]
			if q > p.Stock {
				return &apiError{http.StatusConflict, "err.notEnoughStock"}
			}
			line := InvoiceItem{ProductID: p.ID, Name: p.Name, Price: key.price, Qty: q, Total: key.price * q}
			if db.Settings.TrackProfit && p.CostPrice != nil {
				cost := *p.CostPrice
				line.CostPrice = &cost
			}
			inv.Items = append(inv.Items, line)
			inv.Total += line.Total
			// Keep totals far below the largest whole number a browser can
			// show exactly (about 9 quadrillion).
			if inv.Total > maxTotal {
				return bad("err.tooLarge")
			}
			p.Stock -= q
			p.UpdatedAt = inv.Date
		}

		// Find the customer by phone (or by name when there is no phone),
		// otherwise add a new one.
		cust := -1
		np := normalizePhone(phone)
		for i, c := range db.Customers {
			if np != "" && normalizePhone(c.Phone) == np {
				cust = i
				break
			}
			if np == "" && c.Phone == "" && strings.EqualFold(c.Name, name) {
				cust = i
				break
			}
		}
		if cust == -1 {
			db.Customers = append(db.Customers, Customer{ID: newID(), Name: name, Phone: phone, Address: address, CreatedAt: inv.Date})
			cust = len(db.Customers) - 1
		} else {
			c := &db.Customers[cust]
			c.Name = name
			if address != "" {
				c.Address = address
			}
		}
		c := db.Customers[cust]
		inv.CustomerID = c.ID
		inv.CustomerName = name
		inv.CustomerPhone = phone
		inv.CustomerAddress = address
		if inv.CustomerAddress == "" {
			inv.CustomerAddress = c.Address
		}

		db.Invoices = append(db.Invoices, inv)
		db.NextInvoice++
		if db.SaleRequests == nil {
			db.SaleRequests = map[string]SaleReceipt{}
		}
		db.SaleRequests[in.RequestID] = SaleReceipt{Hash: hash, InvoiceID: inv.ID, Code: inv.Code}
		outcome.fields["invoiceId"] = inv.ID
		return nil
	}, outcome)
}

func (s *Store) deleteInvoice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	restock := r.URL.Query().Get("restock") == "1"
	s.mutate(w, r, func(db *DB) error {
		for i, inv := range db.Invoices {
			if inv.ID != id {
				continue
			}
			if len(inv.Returns) != 0 {
				return &apiError{409, "err.returnDelete"}
			}
			if restock {
				for _, it := range inv.Items {
					for j := range db.Products {
						if db.Products[j].ID == it.ProductID {
							if it.Qty > maxQty-db.Products[j].Stock {
								return bad("err.restockLimit")
							}
							db.Products[j].Stock += it.Qty
							db.Products[j].UpdatedAt = now()
						}
					}
				}
			}
			db.Invoices = append(db.Invoices[:i], db.Invoices[i+1:]...)
			return nil
		}
		return notFound()
	})
}

func (s *Store) saveSettings(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Settings
		NextInvoiceNumber *int64 `json:"nextInvoiceNumber"`
		InvoiceYear       int    `json:"invoiceYear"`
	}
	if err := readJSON(r, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badRequest"})
		return
	}
	in := request.Settings
	var oldLogo string
	s.mutate(w, r, func(db *DB) error {
		if in.Theme != "dark" {
			in.Theme = "light"
		}
		if request.NextInvoiceNumber != nil {
			year := time.Now().Year()
			if request.InvoiceYear != year {
				return &apiError{http.StatusConflict, "err.invoiceYearChanged"}
			}
			if err := db.setNextInvoiceNumber(year, *request.NextInvoiceNumber); err != nil {
				return err
			}
		}
		if in.Language != "ar" {
			in.Language = "en"
		}
		in.StoreName = cleanText(in.StoreName, 200, false)
		in.InvoiceTitle = cleanText(in.InvoiceTitle, 100, false)
		in.Header = cleanText(in.Header, 2000, true)
		in.Footer = cleanText(in.Footer, 2000, true)
		if in.Logo != "" && !validImageName(in.Logo) {
			in.Logo = ""
		}
		if in.LogoSize < 20 {
			in.LogoSize = 20
		}
		if in.LogoSize > 300 {
			in.LogoSize = 300
		}
		switch in.LogoAlign {
		case "start", "center", "end":
		default:
			in.LogoAlign = "center"
		}
		if in.Paper != "receipt" {
			in.Paper = "a4"
		}
		if in.LowStock < 0 {
			in.LowStock = 0
		}
		if in.LowStock > maxQty {
			in.LowStock = maxQty
		}
		def := defaultSettings()
		if !colorRe.MatchString(in.TopbarColor) {
			in.TopbarColor = def.TopbarColor
		}
		in.TopbarColor = strings.ToLower(in.TopbarColor)
		if !colorRe.MatchString(in.AccentColor) {
			in.AccentColor = def.AccentColor
		}
		if !colorRe.MatchString(in.RowColor) {
			in.RowColor = def.RowColor
		}
		in.AccentColor = strings.ToLower(in.AccentColor)
		in.RowColor = strings.ToLower(in.RowColor)
		if db.Settings.Logo != in.Logo {
			oldLogo = db.Settings.Logo
		}
		db.Settings = in
		return nil
	})
	s.mu.Lock()
	if r.Header.Get("X-Inventory-Generation") == s.generation {
		s.removeImagesIfUnused([]string{oldLogo})
	}
	s.mu.Unlock()
}

// uploadImage stores one picture (already resized by the browser) and
// returns its file name. The type is read from the file itself.
func (s *Store) uploadImage(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 15<<20))
	if err != nil || len(body) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badImage"})
		return
	}
	ext := map[string]string{
		"image/jpeg": "jpg",
		"image/png":  "png",
		"image/webp": "webp",
		"image/gif":  "gif",
	}[http.DetectContentType(body)]
	if ext == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badImage"})
		return
	}
	name := newID() + "." + ext
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.checkGenerationLocked(r); err != nil {
		backupError(w, err)
		return
	}
	if err := os.WriteFile(filepath.Join(s.imagesDir, name), body, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "err.save", "detail": err.Error()})
		return
	}
	s.revision++
	writeJSON(w, http.StatusOK, map[string]string{"name": name})
}
