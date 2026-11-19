package main

import (
	"net/http"
	"reflect"
	"testing"
)

func TestA4LayoutPersistenceAndValidation(t *testing.T) {
	srv, s, dir := newTestServer(t)
	settings := s.db.Settings
	settings.A4Layout = &A4Layout{Margin: 20, Font: "serif", FontSize: 18, StoreSize: 32, TitleSize: 26, HeaderAlign: "end", FooterAlign: "start", HeaderGap: 30, FooterGap: 12}
	settings.A4Layout.EnglishFont = "georgia"
	settings.A4Layout.ArabicFont = "traditional"
	settings.A4Layout.Emphasis = "headings"
	settings.A4Layout.TextStyles = map[string]InvoiceTextStyle{
		"labels": {Size: 15, Weight: 700, Color: "#123456"},
		"values": {Weight: 400},
		"totals": {Size: 22, Weight: 500, Color: "#000000"},
	}
	if status, _ := call(t, srv, "PUT", "/api/settings", settings); status != http.StatusOK {
		t.Fatalf("save: %d", status)
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(reopened.db.Settings.A4Layout, settings.A4Layout) {
		t.Fatal("layout did not survive restart")
	}
	invalid := *settings.A4Layout
	invalid.ArabicFont = "unsupported"
	if validA4Layout(&invalid) {
		t.Fatal("unsupported Arabic font accepted")
	}
	for _, widths := range []InvoiceColumnWidths{
		{Number: 7, Price: 4, Quantity: 9, Total: 18},
		{Number: 15, Price: 30, Quantity: 12, Total: 20},
	} {
		invalid = *settings.A4Layout
		invalid.ColumnWidths = &widths
		settings.A4Layout = &invalid
		if status, _ := call(t, srv, "PUT", "/api/settings", settings); status != http.StatusBadRequest {
			t.Fatalf("invalid widths accepted: %d", status)
		}
		settings.A4Layout = s.db.Settings.A4Layout
	}
	invalid = *settings.A4Layout
	invalid.Margin = 100
	settings.A4Layout = &invalid
	if status, _ := call(t, srv, "PUT", "/api/settings", settings); status != http.StatusBadRequest {
		t.Fatalf("invalid margin accepted: %d", status)
	}
	if s.db.Settings.A4Layout.Margin != 20 {
		t.Fatal("invalid save changed settings")
	}
	settings.A4Layout = nil
	if status, _ := call(t, srv, "PUT", "/api/settings", settings); status != http.StatusOK {
		t.Fatalf("reset: %d", status)
	}
	if s.db.Settings.A4Layout != nil {
		t.Fatal("reset did not restore legacy layout")
	}
}

func TestInvoiceTextStyleValidation(t *testing.T) {
	layout := A4Layout{Margin: 12, Font: "system", FontSize: 16, StoreSize: 24, TitleSize: 21, HeaderAlign: "center", FooterAlign: "center", HeaderGap: 16, FooterGap: 24}
	for _, key := range []string{"store", "title", "labels", "values", "tableHeadings", "rows", "totals", "header", "footer"} {
		layout.TextStyles = map[string]InvoiceTextStyle{key: {Size: 8, Weight: 500, Color: "#Ab12EF"}}
		if !validA4Layout(&layout) {
			t.Fatalf("valid style rejected: %s", key)
		}
	}
	for _, style := range []InvoiceTextStyle{{Size: -1}, {Size: 49}, {Weight: 600}, {Color: "red"}, {Color: "#123456;display:none"}} {
		layout.TextStyles = map[string]InvoiceTextStyle{"labels": style}
		if validA4Layout(&layout) {
			t.Fatalf("invalid style accepted: %+v", style)
		}
	}
	layout.TextStyles = map[string]InvoiceTextStyle{"unknown": {Weight: 700}}
	if validA4Layout(&layout) {
		t.Fatal("unknown group accepted")
	}
}

func TestInvoiceTextStylesBackupRoundTrip(t *testing.T) {
	source, s, _ := newTestServer(t)
	settings := s.db.Settings
	settings.A4Layout = &A4Layout{Margin: 12, Font: "system", FontSize: 16, StoreSize: 24, TitleSize: 21, HeaderAlign: "center", FooterAlign: "center", HeaderGap: 16, FooterGap: 24,
		EnglishFont: "manrope", ArabicFont: "notosansarabic",
		ColumnWidths: &InvoiceColumnWidths{Number: 7, Price: 13, Quantity: 9, Total: 18},
		TextStyles:   map[string]InvoiceTextStyle{"labels": {Weight: 700}, "values": {Size: 14, Color: "#000000"}, "footer": {Size: 12, Weight: 500, Color: "#123456"}}}
	if code, _ := call(t, source, "PUT", "/api/settings", settings); code != 200 {
		t.Fatalf("save: %d", code)
	}
	archive := exportForTest(t, source)
	destination, restored, dir := newTestServer(t)
	t.Cleanup(restored.cleanupTransfers)
	preview := previewForTest(t, destination, archive)
	if code, raw, _ := commitForTest(t, destination, preview.Token); code != 200 {
		t.Fatalf("import: %d %s", code, raw)
	}
	if !reflect.DeepEqual(settings, restored.db.Settings) {
		t.Fatal("backup lost text styles or column widths")
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(settings, reopened.db.Settings) {
		t.Fatal("restart changed restored text styles or column widths")
	}
}

func TestAllInvoiceFontsAccepted(t *testing.T) {
	for _, english := range []string{"", "segoe", "arial", "georgia", "inter", "lora", "sourcesans3", "googlesans", "manrope", "ibmplexsans", "notosans"} {
		for _, arabic := range []string{"", "tahoma", "arial", "traditional", "cairo", "tajawal", "amiri", "ibmplexsansarabic", "notosansarabic", "notonaskharabic"} {
			layout := &A4Layout{Margin: 12, Font: "system", FontSize: 16, StoreSize: 24, TitleSize: 21, HeaderAlign: "center", FooterAlign: "center", HeaderGap: 16, FooterGap: 24, EnglishFont: english, ArabicFont: arabic}
			if !validA4Layout(layout) {
				t.Fatalf("rejected supported fonts %q, %q", english, arabic)
			}
		}
	}
}

func TestRetiredGoogleSansBackupAndRestart(t *testing.T) {
	source, s, _ := newTestServer(t)
	settings := s.db.Settings
	settings.A4Layout = &A4Layout{Margin: 12, Font: "system", FontSize: 16, StoreSize: 24, TitleSize: 21, HeaderAlign: "center", FooterAlign: "center", HeaderGap: 16, FooterGap: 24, EnglishFont: "googlesans", ArabicFont: "cairo"}
	if code, _ := call(t, source, "PUT", "/api/settings", settings); code != 200 {
		t.Fatalf("legacy font settings rejected: %d", code)
	}
	_, result := call(t, source, "POST", "/api/products", Product{Name: "Synthetic font test", Price: 100, Stock: 1})
	if code, _ := call(t, source, "POST", "/api/sales", map[string]any{"customer": map[string]string{"name": "Synthetic customer"}, "items": []map[string]any{{"productId": result.DB.Products[0].ID, "qty": 1}}}); code != 200 {
		t.Fatalf("legacy font invoice rejected: %d", code)
	}
	original := s.db.Invoices[0]
	archive := exportForTest(t, source)
	destination, restored, dir := newTestServer(t)
	t.Cleanup(restored.cleanupTransfers)
	preview := previewForTest(t, destination, archive)
	if code, raw, _ := commitForTest(t, destination, preview.Token); code != 200 {
		t.Fatalf("legacy font import: %d %s", code, raw)
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, db := range []*DB{&restored.db, &reopened.db} {
		if !reflect.DeepEqual(settings, db.Settings) || len(db.Invoices) != 1 || !reflect.DeepEqual(original, db.Invoices[0]) {
			t.Fatal("legacy font settings or invoice changed during backup/restart")
		}
	}
}

func TestLegacyA4BackupPreservesCustomLayout(t *testing.T) {
	source, s, _ := newTestServer(t)
	settings := s.db.Settings
	// v0.4.9 had layout values and the original font style, with no per-script fonts.
	settings.A4Layout = &A4Layout{Margin: 17, Font: "serif", FontSize: 15, StoreSize: 29, TitleSize: 23, HeaderAlign: "end", FooterAlign: "start", HeaderGap: 19, FooterGap: 31}
	if code, _ := call(t, source, "PUT", "/api/settings", settings); code != 200 {
		t.Fatalf("legacy settings: %d", code)
	}
	archive := exportForTest(t, source)
	destination, restored, dir := newTestServer(t)
	t.Cleanup(restored.cleanupTransfers)
	preview := previewForTest(t, destination, archive)
	if code, raw, _ := commitForTest(t, destination, preview.Token); code != 200 {
		t.Fatalf("import: %d %s", code, raw)
	}
	if !reflect.DeepEqual(settings, restored.db.Settings) {
		t.Fatal("import replaced legacy customization")
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(settings, reopened.db.Settings) {
		t.Fatal("restart changed imported settings")
	}
}
