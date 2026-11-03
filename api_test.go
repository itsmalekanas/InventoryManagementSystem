package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type payload struct {
	DB        DB     `json:"db"`
	Error     string `json:"error"`
	Name      string `json:"name"`
	InvoiceID string `json:"invoiceId"`
}

func newTestServer(t *testing.T) (*httptest.Server, *Store, string) {
	t.Helper()
	dir := t.TempDir()
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	s.routes(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, s, dir
}

func call(t *testing.T, srv *httptest.Server, method, path string, body any) (int, payload) {
	t.Helper()
	if method == "POST" && path == "/api/sales" {
		if request, ok := body.(map[string]any); ok {
			copy := map[string]any{}
			for key, value := range request {
				copy[key] = value
			}
			if _, exists := copy["requestId"]; !exists {
				copy["requestId"] = newID() + newID()
			}
			body = copy
		}
	}
	var r *bytes.Reader
	if b, ok := body.([]byte); ok {
		r = bytes.NewReader(b)
	} else {
		raw, _ := json.Marshal(body)
		r = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, srv.URL+path, r)
	if method != "GET" {
		res, err := http.Get(srv.URL + "/api/data")
		if err != nil {
			t.Fatal(err)
		}
		var current struct {
			Generation string `json:"generation"`
		}
		json.NewDecoder(res.Body).Decode(&current)
		res.Body.Close()
		req.Header.Set("X-Inventory-Generation", current.Generation)
	}
	if _, ok := body.([]byte); ok {
		req.Header.Set("Content-Type", "application/octet-stream")
	} else {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var p payload
	json.NewDecoder(res.Body).Decode(&p)
	return res.StatusCode, p
}

func TestSaleTotalsStockAndArabic(t *testing.T) {
	srv, _, dir := newTestServer(t)

	_, p := call(t, srv, "POST", "/api/products", Product{Name: "عطر ورد", Price: 25000, Stock: 10})
	rose := p.DB.Products[0].ID
	_, p = call(t, srv, "POST", "/api/products", Product{Name: "Soap", Price: 7500, Stock: 3})
	soap := p.DB.Products[1].ID

	// Same product twice in the request must be merged: 2 + 1 = 3 pieces.
	code, p := call(t, srv, "POST", "/api/sales", map[string]any{
		"customer": map[string]string{"name": "أحمد علي", "phone": "٠٧٧٠ ١٢٣ ٤٥٦٧", "address": "بغداد - الكرادة"},
		"items": []map[string]any{
			{"productId": rose, "qty": 2},
			{"productId": soap, "qty": 3},
			{"productId": rose, "qty": 1},
		},
	})
	if code != 200 {
		t.Fatalf("sale failed: %d %s", code, p.Error)
	}
	inv := p.DB.Invoices[0]
	// 25,000 x 3 = 75,000 and 7,500 x 3 = 22,500, total 97,500
	if len(inv.Items) != 2 || inv.Items[0].Qty != 3 || inv.Items[0].Total != 75000 || inv.Items[1].Total != 22500 || inv.Total != 97500 {
		t.Fatalf("wrong invoice: %+v", inv)
	}
	if inv.Number != 1 || p.DB.NextInvoice != 2 {
		t.Fatalf("wrong numbering: %d next %d", inv.Number, p.DB.NextInvoice)
	}
	if p.DB.Products[0].Stock != 7 || p.DB.Products[1].Stock != 0 {
		t.Fatalf("wrong stock: %d %d", p.DB.Products[0].Stock, p.DB.Products[1].Stock)
	}
	if len(p.DB.Customers) != 1 || p.DB.Customers[0].Name != "أحمد علي" {
		t.Fatalf("customer not saved: %+v", p.DB.Customers)
	}

	// Arabic must be stored as real UTF-8 text in the file.
	raw, _ := os.ReadFile(filepath.Join(dir, "db.json"))
	if !strings.Contains(string(raw), "عطر ورد") || !strings.Contains(string(raw), "بغداد - الكرادة") {
		t.Fatal("Arabic text not found in db.json")
	}

	// Selling more than the stock is refused and changes nothing.
	code, p = call(t, srv, "POST", "/api/sales", map[string]any{
		"customer": map[string]string{"name": "x"},
		"items":    []map[string]any{{"productId": rose, "qty": 1}, {"productId": soap, "qty": 1}},
	})
	if code != http.StatusConflict || p.Error != "err.notEnoughStock" {
		t.Fatalf("expected stock error, got %d %s", code, p.Error)
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if p.DB.Products[0].Stock != 7 || len(p.DB.Invoices) != 1 || len(p.DB.Customers) != 1 {
		t.Fatal("a refused sale changed the data")
	}

	// The same phone typed with Latin digits finds the same customer.
	_, p = call(t, srv, "POST", "/api/sales", map[string]any{
		"customer": map[string]string{"name": "أحمد علي", "phone": "07701234567"},
		"items":    []map[string]any{{"productId": rose, "qty": 1}},
	})
	if len(p.DB.Customers) != 1 || p.DB.Invoices[1].CustomerID != p.DB.Invoices[0].CustomerID {
		t.Fatal("customer was duplicated")
	}
	if p.DB.Invoices[1].CustomerAddress != "بغداد - الكرادة" {
		t.Fatal("saved address was not used on the invoice")
	}
	if p.DB.Invoices[1].Total != 25000 || p.DB.Invoices[1].Number != 2 || p.DB.Products[0].Stock != 6 {
		t.Fatal("second sale wrong")
	}

	// Deleting an invoice with restock returns the pieces.
	first := p.DB.Invoices[0].ID
	_, p = call(t, srv, "DELETE", "/api/invoices/"+first+"?restock=1", nil)
	if p.DB.Products[0].Stock != 9 || p.DB.Products[1].Stock != 3 || len(p.DB.Invoices) != 1 {
		t.Fatalf("restock wrong: %d %d", p.DB.Products[0].Stock, p.DB.Products[1].Stock)
	}
	// Deleting without restock leaves stock alone.
	_, p = call(t, srv, "DELETE", "/api/invoices/"+p.DB.Invoices[0].ID, nil)
	if p.DB.Products[0].Stock != 9 || len(p.DB.Invoices) != 0 {
		t.Fatal("delete without restock changed stock")
	}

	// Invoice numbers never repeat, even after deleting invoices and reopening.
	s2, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s2.db.NextInvoice != 3 {
		t.Fatalf("next invoice after reopen = %d, want 3", s2.db.NextInvoice)
	}
}

func TestValidation(t *testing.T) {
	srv, _, _ := newTestServer(t)
	if code, p := call(t, srv, "POST", "/api/products", Product{Name: " ", Price: 1}); code != 400 || p.Error != "err.nameRequired" {
		t.Fatalf("empty name accepted: %d %s", code, p.Error)
	}
	if code, _ := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: -1}); code != 400 {
		t.Fatal("negative price accepted")
	}
	if code, _ := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: 1, Stock: -2}); code != 400 {
		t.Fatal("negative stock accepted")
	}
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: 1000, Stock: 5})
	id := p.DB.Products[0].ID
	if code, p := call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": ""}, "items": []map[string]any{{"productId": id, "qty": 1}}}); code != 400 || p.Error != "err.customerRequired" {
		t.Fatal("sale without customer accepted")
	}
	if code, _ := call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "a"}, "items": []map[string]any{{"productId": id, "qty": 0}}}); code != 400 {
		t.Fatal("zero quantity accepted")
	}
	if code, _ := call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "a"}, "items": []map[string]any{}}); code != 400 {
		t.Fatal("empty cart accepted")
	}
	call(t, srv, "POST", "/api/customers", Customer{Name: "A", Phone: "0770 111 2222"})
	if code, p := call(t, srv, "POST", "/api/customers", Customer{Name: "B", Phone: "07701112222"}); code != 400 || p.Error != "err.phoneTaken" {
		t.Fatal("duplicate phone accepted")
	}
}

func TestImagesAndSettings(t *testing.T) {
	srv, _, dir := newTestServer(t)
	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89")
	code, p := call(t, srv, "POST", "/api/images", png)
	if code != 200 || !validImageName(p.Name) {
		t.Fatalf("upload failed: %d %+v", code, p)
	}
	if code, _ := call(t, srv, "POST", "/api/images", []byte("not an image")); code != 400 {
		t.Fatal("text accepted as an image")
	}
	_, p2 := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: 1, Images: []string{p.Name, "../../etc/passwd"}})
	if got := p2.DB.Products[0].Images; len(got) != 1 || got[0] != p.Name {
		t.Fatalf("bad image list kept: %v", got)
	}
	// Removing the picture from the product deletes the file.
	prod := p2.DB.Products[0]
	prod.Images = nil
	call(t, srv, "POST", "/api/products", prod)
	if _, err := os.Stat(filepath.Join(dir, "images", p.Name)); !os.IsNotExist(err) {
		t.Fatal("unused picture file was not removed")
	}

	_, p = call(t, srv, "PUT", "/api/settings", Settings{Language: "ar", StoreName: "متجر النور", LogoSize: 1000, LogoAlign: "x", Paper: "receipt", LowStock: -3})
	st := p.DB.Settings
	if st.AccentColor != "#714b67" || st.RowColor != "#f3edf2" || st.ShowPaid {
		t.Fatalf("bad colors not replaced with defaults: %+v", st)
	}
	_, p = call(t, srv, "PUT", "/api/settings", Settings{Theme: "dark", AccentColor: "#1A2B3C", RowColor: "#eeeeee", ShowPaid: true})
	if p.DB.Settings.AccentColor != "#1a2b3c" || p.DB.Settings.RowColor != "#eeeeee" || !p.DB.Settings.ShowPaid {
		t.Fatalf("colors not saved: %+v", p.DB.Settings)
	}
	if p.DB.Settings.Theme != "dark" {
		t.Fatal("dark theme was not saved")
	}
	if st.Language != "ar" || st.StoreName != "متجر النور" || st.LogoSize != 300 || st.LogoAlign != "center" || st.Paper != "receipt" || st.LowStock != 0 {
		t.Fatalf("settings not cleaned: %+v", st)
	}
}

func TestRejectsNonJSON(t *testing.T) {
	srv, _, _ := newTestServer(t)
	res, err := http.Post(srv.URL+"/api/products", "text/plain", strings.NewReader(`{"name":"x","price":1}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatalf("text/plain body accepted: %d", res.StatusCode)
	}
}

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"٠٧٧٠ ١٢٣ ٤٥٦٧":     "07701234567",
		"+964 770-123-4567": "+9647701234567",
		"۰۷۷۰۱۲۳":           "0770123",
		"":                  "",
	}
	for in, want := range cases {
		if got := normalizePhone(in); got != want {
			t.Errorf("normalizePhone(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOldDataGetsNewDefaults(t *testing.T) {
	dir := t.TempDir()
	old := `{"version":1,"nextInvoice":4,"settings":{"language":"ar","storeName":"متجر"},"products":[],"customers":[],"invoices":[]}`
	if err := os.WriteFile(filepath.Join(dir, "db.json"), []byte(old), 0o644); err != nil {
		t.Fatal(err)
	}
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	st := s.db.Settings
	if st.Theme != "light" || st.StoreName != "متجر" || st.AccentColor != "#714b67" || st.RowColor != "#f3edf2" || !st.ShowPaid || s.db.NextInvoice != 4 {
		t.Fatalf("defaults missing after upgrade: %+v next %d", st, s.db.NextInvoice)
	}
}

func TestInvoiceCodes(t *testing.T) {
	srv, _, dir := newTestServer(t)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: 1000, Stock: 10})
	id := p.DB.Products[0].ID
	sale := func(qty int) (int, payload) {
		return call(t, srv, "POST", "/api/sales", map[string]any{
			"customer": map[string]string{"name": "x"},
			"items":    []map[string]any{{"productId": id, "qty": qty}},
		})
	}
	year := time.Now().Year()
	_, p = sale(1)
	if got, want := p.DB.Invoices[0].Code, fmt.Sprintf("INV-HS-%d-00001", year); got != want {
		t.Fatalf("first code %q, want %q", got, want)
	}
	// A refused sale must not use up a number.
	if code, _ := sale(100); code != http.StatusConflict {
		t.Fatal("expected stock error")
	}
	_, p = sale(1)
	if got, want := p.DB.Invoices[1].Code, fmt.Sprintf("INV-HS-%d-00002", year); got != want {
		t.Fatalf("second code %q, want %q", got, want)
	}
	// Deleting the newest invoice does not give its number out again.
	call(t, srv, "DELETE", "/api/invoices/"+p.DB.Invoices[1].ID, nil)
	_, p = sale(1)
	if got, want := p.DB.Invoices[1].Code, fmt.Sprintf("INV-HS-%d-00003", year); got != want {
		t.Fatalf("code after delete %q, want %q", got, want)
	}
	// The counters survive a restart.
	s2, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if c, _, _ := s2.db.nextCode(time.Now()); c != fmt.Sprintf("INV-HS-%d-00004", year) {
		t.Fatalf("after reopen next code is %q", c)
	}
}

func TestInvoiceCodeYearsAndWidth(t *testing.T) {
	db := DB{YearCounters: map[string]int64{}}
	d := func(s string) time.Time { v, _ := time.Parse("2006-01-02", s); return v }
	for _, c := range []struct{ date, want string }{
		{"2026-12-31", "INV-HS-2026-00001"},
		{"2026-12-31", "INV-HS-2026-00002"},
		{"2027-01-01", "INV-HS-2027-00001"}, // a new year starts again at 00001
		{"2027-01-02", "INV-HS-2027-00002"},
	} {
		if got, _, _ := db.nextCode(d(c.date)); got != c.want {
			t.Fatalf("%s: got %s, want %s", c.date, got, c.want)
		}
	}
	if got := invoiceCode(2026, 123456); got != "INV-HS-2026-123456" {
		t.Fatalf("long number cut: %s", got)
	}
}

func TestOldInvoicesGetCodes(t *testing.T) {
	dir := t.TempDir()
	old := `{"version":1,"nextInvoice":4,"settings":{},"products":[],"customers":[],"invoices":[
	 {"id":"b","number":3,"date":"2026-02-01T10:00:00+03:00","items":[],"total":0},
	 {"id":"a","number":1,"date":"2025-12-30T10:00:00+03:00","items":[],"total":0},
	 {"id":"c","number":2,"date":"2026-01-05T10:00:00+03:00","items":[],"total":0}]}`
	os.WriteFile(filepath.Join(dir, "db.json"), []byte(old), 0o644)
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, inv := range s.db.Invoices {
		got[inv.ID] = inv.Code
	}
	if got["a"] != "INV-HS-2025-00001" || got["c"] != "INV-HS-2026-00001" || got["b"] != "INV-HS-2026-00002" {
		t.Fatalf("old invoices numbered wrong: %v", got)
	}
	if s.db.YearCounters["2026"] != 2 {
		t.Fatalf("counter = %d", s.db.YearCounters["2026"])
	}
	raw, _ := os.ReadFile(filepath.Join(dir, "db.json"))
	if !strings.Contains(string(raw), "INV-HS-2026-00002") {
		t.Fatal("codes were not saved to db.json")
	}
}

func TestInvoiceNumberJumps(t *testing.T) {
	srv, _, dir := newTestServer(t)
	year := time.Now().Year()
	key := fmt.Sprint(year)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: 1000, Stock: 20})
	productID := p.DB.Products[0].ID
	sale := func(number any, qty int) (int, payload) {
		request := map[string]any{
			"customer": map[string]string{"name": "Buyer"},
			"items":    []map[string]any{{"productId": productID, "qty": qty}},
		}
		if number != nil {
			request["invoiceNumber"] = number
			request["invoiceYear"] = year
		}
		return call(t, srv, "POST", "/api/sales", request)
	}
	code, p := call(t, srv, "PUT", "/api/settings", map[string]any{
		"storeName": "Numbered shop", "nextInvoiceNumber": 500, "invoiceYear": year,
	})
	if code != 200 || p.DB.YearCounters[key] != 499 {
		t.Fatalf("settings jump failed: %d %+v", code, p)
	}
	code, p = sale(nil, 1)
	if code != 200 || p.DB.Invoices[0].Code != invoiceCode(year, 500) || p.DB.Invoices[0].Number != 1 {
		t.Fatalf("automatic sale after jump failed: %d %+v", code, p)
	}
	// A failed override does not reserve numbers or reduce stock.
	code, p = sale(700, 100)
	if code != http.StatusConflict || p.Error != "err.notEnoughStock" {
		t.Fatalf("expected stock rejection: %d %+v", code, p)
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if p.DB.YearCounters[key] != 500 || p.DB.Products[0].Stock != 19 || len(p.DB.Invoices) != 1 {
		t.Fatal("failed override changed the database")
	}
	code, p = sale(700, 1)
	if code != 200 || p.DB.Invoices[1].Seq != 700 || p.DB.Invoices[1].Number != 2 {
		t.Fatalf("override failed: %d %+v", code, p)
	}
	lastID := p.DB.Invoices[1].ID
	for _, n := range []int{1, 500, 600, 700} {
		if code, p = sale(n, 1); code != http.StatusConflict || p.Error != "err.invoiceNumberUsed" {
			t.Fatalf("number %d reused: %d %+v", n, code, p)
		}
	}
	call(t, srv, "DELETE", "/api/invoices/"+lastID, nil)
	if code, p = sale(700, 1); code != http.StatusConflict || p.Error != "err.invoiceNumberUsed" {
		t.Fatal("deleted invoice number reused")
	}
	code, p = sale(nil, 1)
	if code != 200 || p.DB.Invoices[1].Seq != 701 || p.DB.NextInvoice != 4 {
		t.Fatalf("automatic sequence did not continue: %d %+v", code, p)
	}
	// A stale settings tab cannot rewind numbering or partially save settings.
	code, p = call(t, srv, "PUT", "/api/settings", map[string]any{
		"storeName": "Should not save", "nextInvoiceNumber": 600, "invoiceYear": year,
	})
	if code != http.StatusConflict || p.Error != "err.invoiceNumberUsed" {
		t.Fatalf("settings rewound the counter: %d %+v", code, p)
	}
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if s.db.YearCounters[key] != 701 || s.db.Settings.StoreName != "Numbered shop" {
		t.Fatal("counter or atomic settings save did not survive restart")
	}
	if got, _, _ := s.db.nextCode(time.Now()); got != invoiceCode(year, 702) {
		t.Fatalf("wrong number after restart: %s", got)
	}
}

func TestInvoiceNumberValidation(t *testing.T) {
	srv, _, _ := newTestServer(t)
	year := time.Now().Year()
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "a", Price: 1, Stock: 10})
	productID := p.DB.Products[0].ID
	for _, n := range []any{0, -1, 1.5, "500", int64(maxInvoiceSequence + 1)} {
		for _, settings := range []bool{false, true} {
			path := "/api/sales"
			method := "POST"
			request := map[string]any{"invoiceNumber": n, "invoiceYear": year,
				"customer": map[string]string{"name": "Buyer"},
				"items":    []map[string]any{{"productId": productID, "qty": 1}},
			}
			if settings {
				path, method = "/api/settings", "PUT"
				request = map[string]any{"nextInvoiceNumber": n, "invoiceYear": year}
			}
			if code, _ := call(t, srv, method, path, request); code != http.StatusBadRequest {
				t.Fatalf("invalid number %v accepted by %s: %d", n, path, code)
			}
		}
	}
	for _, y := range []int{0, year - 1, year + 1} {
		code, p := call(t, srv, "POST", "/api/sales", map[string]any{
			"invoiceNumber": 500, "invoiceYear": y,
			"customer": map[string]string{"name": "Buyer"},
			"items":    []map[string]any{{"productId": productID, "qty": 1}},
		})
		if code != http.StatusConflict || p.Error != "err.invoiceYearChanged" {
			t.Fatalf("wrong year accepted: %d %+v", code, p)
		}
		code, p = call(t, srv, "PUT", "/api/settings", map[string]any{"nextInvoiceNumber": 500, "invoiceYear": y})
		if code != http.StatusConflict || p.Error != "err.invoiceYearChanged" {
			t.Fatal("settings accepted wrong year")
		}
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if len(p.DB.Invoices) != 0 || p.DB.Products[0].Stock != 10 || p.DB.YearCounters[fmt.Sprint(year)] != 0 {
		t.Fatal("rejected numbering changed data")
	}
	// The largest supported number is usable once; exhaustion cannot change stock.
	code, p := call(t, srv, "POST", "/api/sales", map[string]any{
		"invoiceNumber": maxInvoiceSequence, "invoiceYear": year,
		"customer": map[string]string{"name": "Buyer"},
		"items":    []map[string]any{{"productId": productID, "qty": 1}},
	})
	if code != 200 || p.DB.Invoices[0].Seq != maxInvoiceSequence {
		t.Fatalf("maximum number rejected: %d %+v", code, p)
	}
	code, p = call(t, srv, "POST", "/api/sales", map[string]any{
		"customer": map[string]string{"name": "Buyer"},
		"items":    []map[string]any{{"productId": productID, "qty": 1}},
	})
	if code != http.StatusBadRequest || p.Error != "err.invoiceNumber" {
		t.Fatalf("exhausted sequence accepted: %d %+v", code, p)
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if p.DB.Products[0].Stock != 9 || len(p.DB.Invoices) != 1 {
		t.Fatal("exhausted sequence changed the sale data")
	}
}
