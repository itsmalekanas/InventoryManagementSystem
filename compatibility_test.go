package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// The schema from the original supplied app must keep working as-is, including
// historical invoice snapshots, Arabic text, picture references and counters.
func TestOriginalAppDataCompatibility(t *testing.T) {
	dir := t.TempDir()
	images := filepath.Join(dir, "images")
	if err := os.MkdirAll(images, 0o755); err != nil {
		t.Fatal(err)
	}
	raw := []byte(`{
	  "version":1,"nextInvoice":43,"yearCounters":{"2026":42},
	  "settings":{"language":"ar","storeName":"متجر الورد","showStoreName":true,
	    "logo":"1111111111111111.png","logoSize":95,"logoAlign":"end",
	    "invoiceTitle":"فاتورة بيع","header":"بغداد 0770 123 4567","footer":"شكراً لزيارتكم",
	    "paper":"receipt","lowStock":3,"accentColor":"#123456","rowColor":"#eeeeee","showPaid":true},
	  "products":[{"id":"product","name":"عطر ورد","price":25000,"stock":7,
	    "images":["2222222222222222.jpg"],"createdAt":"2026-01-01T10:00:00+03:00","updatedAt":"2026-01-02T10:00:00+03:00"}],
	  "customers":[{"id":"customer","name":"أحمد علي","phone":"٠٧٧٠١٢٣٤٥٦٧","address":"بغداد - الكرادة","createdAt":"2026-01-01T10:00:00+03:00"}],
	  "invoices":[{"id":"invoice","number":42,"code":"INV-HS-2026-00042","year":2026,"seq":42,
	    "date":"2026-01-02T10:00:00+03:00","customerId":"customer","customerName":"أحمد علي",
	    "customerPhone":"٠٧٧٠١٢٣٤٥٦٧","customerAddress":"بغداد - الكرادة",
	    "items":[{"productId":"product","name":"عطر ورد سابق","price":20000,"qty":3,"total":60000}],"total":60000}]
	}`)
	if err := os.WriteFile(filepath.Join(dir, "db.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"1111111111111111.png", "2222222222222222.jpg"} {
		if err := os.WriteFile(filepath.Join(images, name), []byte("unchanged picture bytes"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	var original DB
	if err := json.Unmarshal(raw, &original); err != nil {
		t.Fatal(err)
	}
	// The display theme is an optional setting added after the original app.
	original.Settings.Theme = "light"
	original.Settings.ShowDate, original.Settings.ShowTime = true, true
	s, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(original, s.db) {
		t.Fatal("loading changed original app data")
	}
	loaded, err := os.ReadFile(filepath.Join(dir, "db.json"))
	if err != nil || !bytes.Equal(raw, loaded) {
		t.Fatal("opening original database rewrote its file")
	}
	for _, name := range []string{"1111111111111111.png", "2222222222222222.jpg"} {
		picture, err := os.ReadFile(filepath.Join(images, name))
		if err != nil || string(picture) != "unchanged picture bytes" {
			t.Fatal("loading changed a referenced picture")
		}
	}
	mux := http.NewServeMux()
	s.routes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	// A normal save using the new app must preserve all original data too.
	if code, _ := call(t, srv, "PUT", "/api/settings", original.Settings); code != 200 {
		t.Fatal("could not save original settings")
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(original, reopened.db) {
		t.Fatal("saving/reopening changed original data")
	}
}
