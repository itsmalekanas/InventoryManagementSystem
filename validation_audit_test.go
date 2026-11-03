package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJSONRequestsRequireOneObject(t *testing.T) {
	for _, body := range []string{"null", "[]", "{} {}", "{} garbage", "", "{", "true"} {
		req := httptest.NewRequest("POST", "/", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		var value struct{ Name string }
		if err := readJSON(req, &value); err == nil {
			t.Errorf("accepted malformed JSON body %q", body)
		}
	}
	for _, mediaType := range []string{"text/plain", "application/json-invalid"} {
		req := httptest.NewRequest("POST", "/", strings.NewReader("{}"))
		req.Header.Set("Content-Type", mediaType)
		if err := readJSON(req, &struct{}{}); err == nil {
			t.Errorf("accepted media type %q", mediaType)
		}
	}
	req := httptest.NewRequest("POST", "/", strings.NewReader("{\"name\":\"Valid\"} \n"))
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	var value struct{ Name string }
	if err := readJSON(req, &value); err != nil || value.Name != "Valid" {
		t.Fatal("valid JSON rejected", err)
	}
}

func TestInvoiceRestockLimitRollsBack(t *testing.T) {
	srv, _, _ := newTestServer(t)
	_, p := call(t, srv, "POST", "/api/products", Product{Name: "Item", Price: 100, Stock: 10})
	product := p.DB.Products[0]
	_, p = call(t, srv, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Buyer"}, "items": []map[string]any{{"productId": product.ID, "qty": 2}}})
	inv := p.DB.Invoices[0]
	product.Stock = maxQty
	call(t, srv, "POST", "/api/products", product)
	code, result := call(t, srv, "DELETE", "/api/invoices/"+inv.ID+"?restock=1", nil)
	if code != 400 || result.Error != "err.restockLimit" {
		t.Fatal("over-limit restock accepted", code, result.Error)
	}
	_, p = call(t, srv, "GET", "/api/data", nil)
	if p.DB.Products[0].Stock != maxQty || len(p.DB.Invoices) != 1 {
		t.Fatal("rejected delete changed stock or invoices")
	}
	code, p = call(t, srv, "DELETE", "/api/invoices/"+inv.ID+"?restock=0", nil)
	if code != 200 || p.DB.Products[0].Stock != maxQty || len(p.DB.Invoices) != 0 {
		t.Fatal("non-restocking deletion failed")
	}
}
