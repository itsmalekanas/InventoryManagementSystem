package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
)

func protectedSale(t *testing.T, srv *httptest.Server) map[string]any {
	t.Helper()
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "Perfume", Price: 25000, Stock: 10})
	return map[string]any{"requestId": newID() + newID(), "customer": map[string]string{"name": "أحمد", "phone": "07701234567"}, "items": []map[string]any{{"productId": p.DB.Products[len(p.DB.Products)-1].ID, "qty": 2}}}
}

func TestCheckoutRetriesReturnOriginalWithoutChangingData(t *testing.T) {
	srv, s, dir := newTestServer(t)
	request := protectedSale(t, srv)
	code, first := call(t, srv, "POST", "/api/sales", request)
	if code != 200 {
		t.Fatal(code, first.Error)
	}
	before := directoryFiles(t, dir)
	code, retry := call(t, srv, "POST", "/api/sales", request)
	if code != 200 || !reflect.DeepEqual(first.DB, retry.DB) || !reflect.DeepEqual(before, directoryFiles(t, dir)) {
		t.Fatal("retry changed invoice, stock or files")
	}
	if len(s.db.Invoices) != 1 || s.db.Products[0].Stock != 8 || s.db.NextInvoice != 2 {
		t.Fatal("retry duplicated sale")
	}
	// Different details cannot be submitted under the already accepted key.
	request["customer"] = map[string]string{"name": "Another buyer"}
	code, p := call(t, srv, "POST", "/api/sales", request)
	if code != http.StatusConflict || p.Error != "err.saleRequestChanged" {
		t.Fatal("request key reused for changed details")
	}
	request["customer"] = map[string]string{"name": "أحمد", "phone": "07701234567"}
	// Durable receipts also protect retries after a process restart.
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	reopened.routes(mux)
	restarted := httptest.NewServer(mux)
	defer restarted.Close()
	code, p = call(t, restarted, "POST", "/api/sales", request)
	if code != 200 || !reflect.DeepEqual(first.DB, p.DB) {
		t.Fatal("retry after restart was not idempotent")
	}
	call(t, restarted, "DELETE", "/api/invoices/"+p.DB.Invoices[0].ID, nil)
	code, p = call(t, restarted, "POST", "/api/sales", request)
	if code != 409 || p.Error != "err.saleDeleted" {
		t.Fatal("retry recreated deleted invoice")
	}
	if len(reopened.db.Invoices) != 0 || reopened.db.Products[0].Stock != 8 {
		t.Fatal("deleted receipt changed stock")
	}
}

func TestConcurrentCheckoutRetriesOnlySaveOnce(t *testing.T) {
	srv, s, _ := newTestServer(t)
	request := protectedSale(t, srv)
	var group sync.WaitGroup
	statuses := make(chan int, 8)
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() { defer group.Done(); code, _ := call(t, srv, "POST", "/api/sales", request); statuses <- code }()
	}
	group.Wait()
	close(statuses)
	for code := range statuses {
		if code != 200 {
			t.Fatal("concurrent retry failed", code)
		}
	}
	if len(s.db.Invoices) != 1 || len(s.db.SaleRequests) != 1 || s.db.Products[0].Stock != 8 {
		t.Fatal("parallel retries duplicated checkout")
	}
}

func TestCheckoutCancellationBlocksLateRequests(t *testing.T) {
	srv, s, _ := newTestServer(t)
	request := protectedSale(t, srv)
	if code, _ := call(t, srv, "POST", "/api/sales/cancel", request); code != 200 {
		t.Fatal("cancel failed")
	}
	code, p := call(t, srv, "POST", "/api/sales", request)
	if code != 409 || p.Error != "err.saleCancelled" || len(s.db.Invoices) != 0 || s.db.Products[0].Stock != 10 {
		t.Fatal("late request completed a cancelled checkout")
	}
	// Once completed, cancelling that attempt must return the saved invoice.
	request["requestId"] = newID() + newID()
	call(t, srv, "POST", "/api/sales", request)
	code, p = call(t, srv, "POST", "/api/sales/cancel", request)
	if code != 200 || len(p.DB.Invoices) != 1 || p.DB.Products[0].Stock != 8 {
		t.Fatal("cancelling completed checkout changed it")
	}
	if len(exportForTest(t, srv)) == 0 {
		t.Fatal("checkout/cancellation receipts could not be backed up")
	}
}

func TestFailedSaveDoesNotRememberCheckout(t *testing.T) {
	srv, s, dir := newTestServer(t)
	request := protectedSale(t, srv)
	rawBefore, _ := json.Marshal(s.db)
	var before DB
	json.Unmarshal(rawBefore, &before)
	realFile := s.file
	s.file = filepath.Join(dir, "blocked")
	if err := os.Mkdir(s.file, 0o755); err != nil {
		t.Fatal(err)
	}
	code, p := call(t, srv, "POST", "/api/sales", request)
	if code != 500 || p.Error != "err.save" || !reflect.DeepEqual(before, s.db) {
		t.Fatal("failed save retained stock/invoice/request changes")
	}
	s.file = realFile
	code, p = call(t, srv, "POST", "/api/sales", request)
	if code != 200 || len(p.DB.Invoices) != 1 || p.DB.Products[0].Stock != 8 {
		t.Fatal("retry after save failure failed")
	}
}

func TestCheckoutNeedsValidRequestID(t *testing.T) {
	srv, _, _ := newTestServer(t)
	request := protectedSale(t, srv)
	for _, id := range []string{"", "bad", "../../file"} {
		request["requestId"] = id
		raw, _ := json.Marshal(request)
		code, _, p := transferCall(t, srv, "POST", "/api/sales", raw, "application/json", "")
		if code != 400 || p.Error != "err.saleRequest" {
			t.Fatal("invalid request key accepted")
		}
	}
}

func TestRetryTargetsOriginalInvoiceNotNewest(t *testing.T) {
	srv, _, _ := newTestServer(t)
	request := protectedSale(t, srv)
	_, first := call(t, srv, "POST", "/api/sales", request)
	other := map[string]any{}
	for key, value := range request {
		other[key] = value
	}
	other["requestId"] = newID() + newID()
	call(t, srv, "POST", "/api/sales", other)
	code, replayed := call(t, srv, "POST", "/api/sales", request)
	if code != 200 || replayed.InvoiceID != first.DB.Invoices[0].ID || replayed.InvoiceID == replayed.DB.Invoices[1].ID || replayed.DB.Products[0].Stock != 6 {
		t.Fatal("retry returned newest invoice or changed stock")
	}
}

func TestConcurrentCancelAndCheckoutCannotBothChangeStock(t *testing.T) {
	srv, s, _ := newTestServer(t)
	request := protectedSale(t, srv)
	var group sync.WaitGroup
	for _, path := range []string{"/api/sales", "/api/sales/cancel"} {
		group.Add(1)
		go func(path string) { defer group.Done(); call(t, srv, "POST", path, request) }(path)
	}
	group.Wait()
	if len(s.db.SaleRequests) != 1 {
		t.Fatal("checkout/cancellation receipt lost")
	}
	if len(s.db.Invoices) == 0 && s.db.Products[0].Stock == 10 {
		return
	}
	if len(s.db.Invoices) == 1 && s.db.Products[0].Stock == 8 {
		return
	}
	t.Fatal("cancellation and sale left inconsistent stock")
}
