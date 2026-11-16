package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSettingsStaleDraftRejected(t *testing.T) {
	srv, s, _ := newTestServer(t)
	original := s.db.Settings
	token := settingsToken(original)
	first := original
	first.Footer = "Changed by first tab"
	request := func(settings Settings) map[string]any {
		return map[string]any{"expectedSettingsToken": token, "storeName": settings.StoreName, "footer": settings.Footer, "logoSize": settings.LogoSize, "paper": settings.Paper, "language": settings.Language}
	}
	if code, _ := call(t, srv, "PUT", "/api/settings", request(first)); code != 200 {
		t.Fatalf("first save %d", code)
	}
	if code, result := call(t, srv, "PUT", "/api/settings", request(original)); code != 409 || result.Error != "err.settingsChanged" {
		t.Fatalf("stale save: %d %+v", code, result)
	}
	if s.db.Settings.Footer != first.Footer {
		t.Fatal("stale draft replaced newer settings")
	}
}

func TestDailyBackupFailureWarnsWithoutLosingSave(t *testing.T) {
	_, s, dir := newTestServer(t)
	backupDir := filepath.Join(dir, "backups")
	// A file at today's backup destination deterministically blocks replacement.
	target := filepath.Join(backupDir, "db-"+time.Now().Format("2006-01-02")+".json")
	if err := os.Mkdir(target, 0700); err != nil {
		t.Fatal(err)
	}
	s.db.Settings.StoreName = "Saved despite backup failure"
	if err := s.saveLocked(); err != nil {
		t.Fatal(err)
	}
	if s.backupWarning == "" {
		t.Fatal("missing backup warning")
	}
	reopened, err := OpenStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if reopened.db.Settings.StoreName != s.db.Settings.StoreName {
		t.Fatal("save lost")
	}
	if err := os.Remove(target); err != nil {
		t.Fatal(err)
	}
	if err := s.saveLocked(); err != nil {
		t.Fatal(err)
	}
	if s.backupWarning != "" {
		t.Fatal("warning remained after successful retry")
	}
	if _, err := os.Stat(target + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("backup staging file remains")
	}
}
