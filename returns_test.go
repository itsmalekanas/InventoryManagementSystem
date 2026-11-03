package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
)

func costPointer(n int64) *int64 { return &n }

func TestOptionalCostsAndReturns(t *testing.T) {
	srv, store, dir := newTestServer(t)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "Item", Price: 100, CostPrice: costPointer(60), Stock: 10})
	id := p.DB.Products[0].ID
	sale := func() payload {
		code, result := call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{{"productId": id, "qty": 2}}})
		if code != 200 {
			t.Fatal(code, result.Error)
		}
		return result
	}
	p = sale()
	if p.DB.Invoices[0].Items[0].CostPrice != nil {
		t.Fatal("disabled tracking saved costs")
	}
	settings := p.DB.Settings
	settings.TrackProfit = true
	call(t, srv, "PUT", "/api/settings", settings)
	p = sale()
	inv := p.DB.Invoices[1]
	if inv.Items[0].CostPrice == nil || *inv.Items[0].CostPrice != 60 {
		t.Fatal("cost not snapshotted")
	}
	product := p.DB.Products[0]
	product.CostPrice = costPointer(0)
	_, p = call(t, srv, "POST", "/api/products", product)
	if *p.DB.Invoices[1].Items[0].CostPrice != 60 {
		t.Fatal("editing product changed invoice cost")
	}
	path := "/api/invoices/" + inv.ID + "/returns"
	request := map[string]any{"requestId": newID() + newID(), "restock": true, "items": []ReturnItem{{Index: 0, Qty: 1}}}
	code, p := call(t, srv, "POST", path, request)
	if code != 200 || p.DB.Products[0].Stock != 7 || p.DB.Invoices[1].Returns[0].Total != 100 || p.DB.Invoices[1].Total != 200 {
		t.Fatal("incorrect partial return", code, p)
	}
	code, p = call(t, srv, "POST", path, request)
	if code != 200 || p.DB.Products[0].Stock != 7 || len(p.DB.Invoices[1].Returns) != 1 {
		t.Fatal("retry repeated refund")
	}
	request["restock"] = false
	code, _ = call(t, srv, "POST", path, request)
	if code != 409 {
		t.Fatal("changed retry accepted")
	}
	request["requestId"] = newID() + newID()
	request["items"] = []ReturnItem{{Index: 0, Qty: 2}}
	code, _ = call(t, srv, "POST", path, request)
	if code != 409 {
		t.Fatal("over-return accepted")
	}
	request["items"] = []ReturnItem{{Index: 0, Qty: 1}}
	code, p = call(t, srv, "POST", path, request)
	if code != 200 || p.DB.Products[0].Stock != 7 || len(p.DB.Invoices[1].Returns) != 2 {
		t.Fatal("non-restocking return failed")
	}
	code, _ = call(t, srv, "DELETE", "/api/invoices/"+inv.ID+"?restock=1", nil)
	if code != 409 {
		t.Fatal("invoice with returns deleted")
	}
	if err := validateBackupDB(p.DB, map[string]bool{}); err != nil {
		t.Fatal("new records rejected by backup validator", err)
	}
	reopened, err := OpenStore(dir)
	if err != nil || len(reopened.db.Invoices[1].Returns) != 2 {
		t.Fatal("returns not durable", err)
	}
	store.mu.Lock()
	if store.db.Invoices[1].Items[0].CostPrice == nil {
		t.Fatal("missing original cost")
	}
	store.mu.Unlock()
	archive := exportForTest(t, srv)
	destination, _, _ := newTestServer(t)
	preview := previewForTest(t, destination, archive)
	status, _, restored := commitForTest(t, destination, preview.Token)
	if status != 200 || !reflect.DeepEqual(p.DB, restored.DB) {
		t.Fatal("costs or returns lost during backup transfer")
	}
}

func TestReturnFailedSaveAndConcurrentRetries(t *testing.T) {
	srv, store, dir := newTestServer(t)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "Item", Price: 100, Stock: 10})
	id := p.DB.Products[0].ID
	_, p = call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{{"productId": id, "qty": 2, "customPrice": 75}}})
	path := "/api/invoices/" + p.DB.Invoices[0].ID + "/returns"
	request := map[string]any{"requestId": newID() + newID(), "restock": true, "items": []ReturnItem{{Index: 0, Qty: 1}}}
	raw, _ := json.Marshal(store.db)
	var before DB
	json.Unmarshal(raw, &before)
	realFile := store.file
	store.file = filepath.Join(dir, "blocked")
	if err := os.Mkdir(store.file, 0o755); err != nil {
		t.Fatal(err)
	}
	status, _ := call(t, srv, "POST", path, request)
	if status != 500 || !reflect.DeepEqual(before, store.db) {
		t.Fatal("failed save retained refund or stock changes")
	}
	store.file = realFile
	var group sync.WaitGroup
	statuses := make(chan int, 8)
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() { defer group.Done(); code, _ := call(t, srv, "POST", path, request); statuses <- code }()
	}
	group.Wait()
	close(statuses)
	for code := range statuses {
		if code != 200 {
			t.Fatal("concurrent retry failed", code)
		}
	}
	if len(store.db.Invoices[0].Returns) != 1 || store.db.Invoices[0].Returns[0].Total != 75 || store.db.Products[0].Stock != 9 {
		t.Fatal("retries duplicated refund/restock or ignored custom sale price")
	}
}

func TestReturnValidationAndRollback(t *testing.T) {
	srv, _, _ := newTestServer(t)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "Item", Price: 100, Stock: 3})
	id := p.DB.Products[0].ID
	_, p = call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{{"productId": id, "qty": 2}}})
	inv := p.DB.Invoices[0]
	for _, items := range [][]ReturnItem{nil, {{Index: -1, Qty: 1}}, {{Index: 5, Qty: 1}}, {{Index: 0, Qty: 0}}, {{Index: 0, Qty: -1}}, {{Index: 0, Qty: 3}}, {{Index: 0, Qty: 1}, {Index: 0, Qty: 1}}} {
		code, result := call(t, srv, "POST", "/api/invoices/"+inv.ID+"/returns", map[string]any{"requestId": newID() + newID(), "restock": true, "items": items})
		if code == http.StatusOK {
			t.Fatal("invalid return accepted", items, result)
		}
	}
	call(t, srv, "DELETE", "/api/products/"+id, nil)
	request := map[string]any{"requestId": newID() + newID(), "restock": true, "items": []ReturnItem{{Index: 0, Qty: 1}}}
	code, _ := call(t, srv, "POST", "/api/invoices/"+inv.ID+"/returns", request)
	if code != 400 {
		t.Fatal("restocked deleted product")
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if len(p.DB.Invoices[0].Returns) != 0 {
		t.Fatal("failed restock retained refund")
	}
	request["restock"] = false
	code, _ = call(t, srv, "POST", "/api/invoices/"+inv.ID+"/returns", request)
	if code != 200 {
		t.Fatal("deleted product cannot be refunded without restock")
	}
	for _, cost := range []int64{-1, maxPrice + 1} {
		code, _ := call(t, srv, "POST", "/api/products", Product{Name: "Invalid", CostPrice: &cost})
		if code != 400 {
			t.Fatal("invalid cost accepted")
		}
	}
}
