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
