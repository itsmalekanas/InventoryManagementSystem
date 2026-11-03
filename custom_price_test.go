package main

import "testing"

func TestCustomSalePrices(t *testing.T) {
	srv, _, _ := newTestServer(t)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "Item", Price: 100, Stock: 10})
	id := p.DB.Products[0].ID
	request := map[string]any{"requestId": newID() + newID(), "customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{
		{"productId": id, "qty": 2, "customPrice": 25},
		{"productId": id, "qty": 1, "customPrice": 0},
		{"productId": id, "qty": 1},
		{"productId": id, "qty": 1, "customPrice": 25},
	}}
	code, p := call(t, srv, "POST", "/api/sales", request)
	if code != 200 {
		t.Fatal(code, p.Error)
	}
	inv := p.DB.Invoices[0]
	if inv.Total != 175 || len(inv.Items) != 3 || inv.Items[0].Qty != 3 || inv.Items[1].Price != 0 || p.DB.Products[0].Price != 100 || p.DB.Products[0].Stock != 5 {
		t.Fatalf("incorrect custom sale: %+v", p.DB)
	}
	code, retry := call(t, srv, "POST", "/api/sales", request)
	if code != 200 || retry.InvoiceID != inv.ID || retry.DB.Products[0].Stock != 5 {
		t.Fatal("custom checkout retry changed stock")
	}
	request["items"].([]map[string]any)[0]["customPrice"] = 26
	code, _ = call(t, srv, "POST", "/api/sales", request)
	if code != 409 {
		t.Fatal("changed override accepted under same checkout ID")
	}
	for _, price := range []any{-1, 1000000001, 1.5, "25"} {
		code, p = call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{{"productId": id, "qty": 1, "customPrice": price}}})
		if code != 400 {
			t.Fatalf("invalid price %v accepted: %d", price, code)
		}
	}
	code, p = call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{{"productId": id, "qty": 3, "customPrice": 0}, {"productId": id, "qty": 3, "customPrice": 25}}})
	if code != 409 {
		t.Fatal("mixed prices bypassed total stock check")
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if p.DB.Products[0].Stock != 5 || len(p.DB.Invoices) != 1 {
		t.Fatal("rejected sale changed saved data")
	}
}
