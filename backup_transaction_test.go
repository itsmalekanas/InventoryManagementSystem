package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func importDirectoriesForTest(t *testing.T) (string, string, string) {
	t.Helper()
	root := t.TempDir()
	dir := filepath.Join(root, "data")
	stage := filepath.Join(root, ".data-import-test")
	previous := filepath.Join(root, ".data-previous-test")
	for _, name := range []string{dir, stage} {
		if err := os.Mkdir(name, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(name, "db.json"), []byte(filepath.Base(name)), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	raw, err := os.ReadFile(filepath.Join(stage, "db.json"))
	if err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(raw)
	manifest := backupManifest{App: appID, Format: backupFormat, Files: []backupEntry{{Path: "db.json", Size: int64(len(raw)), SHA256: hex.EncodeToString(hash[:])}}}
	metadata, _ := json.Marshal(manifest)
	if err := writeSyncedFile(filepath.Join(stage, ".import-manifest.json"), metadata); err != nil {
		t.Fatal(err)
	}
	return dir, stage, previous
}

func TestImportSwapFailuresRestoreOriginal(t *testing.T) {
	for _, failure := range []string{"first rename", "second rename", "rollback rename"} {
		t.Run(failure, func(t *testing.T) {
			dir, stage, _ := importDirectoriesForTest(t)
			calls := 0
			rename := func(from, to string) error {
				calls++
				if (failure == "first rename" && calls == 1) || (failure != "first rename" && calls == 2) || (failure == "rollback rename" && calls == 3) {
					return errors.New("injected filesystem failure")
				}
				return os.Rename(from, to)
			}
			if err := installImport(dir, stage, rename); err == nil {
				t.Fatal("injected failure was ignored")
			}
			if failure == "rollback rename" {
				if err := recoverImport(dir); err != nil {
					t.Fatal(err)
				}
			}
			raw, err := os.ReadFile(filepath.Join(dir, "db.json"))
			if err != nil || string(raw) != "data" {
				t.Fatal("original data was lost")
			}
			if _, err := os.Stat(importJournalPath(dir)); !os.IsNotExist(err) {
				t.Fatal("rolled back import left a journal")
			}
		})
	}
}

func TestImportRecoversEveryInterruptedSwapPhase(t *testing.T) {
	for _, phase := range []string{"before rename", "between renames", "after commit", "after cleanup"} {
		t.Run(phase, func(t *testing.T) {
			dir, stage, previous := importDirectoriesForTest(t)
			journal := importJournal{Version: 1, Stage: stage, Previous: previous}
			if err := writeImportJournal(dir, journal); err != nil {
				t.Fatal(err)
			}
			if phase != "before rename" {
				if err := os.Rename(dir, previous); err != nil {
					t.Fatal(err)
				}
			}
			if phase == "after commit" || phase == "after cleanup" {
				if err := os.Rename(stage, dir); err != nil {
					t.Fatal(err)
				}
			}
			if phase == "after cleanup" {
				if err := os.RemoveAll(previous); err != nil {
					t.Fatal(err)
				}
			}
			if err := recoverImport(dir); err != nil {
				t.Fatal(err)
			}
			wanted := "data"
			if phase == "after commit" || phase == "after cleanup" {
				wanted = ".data-import-test"
			}
			raw, err := os.ReadFile(filepath.Join(dir, "db.json"))
			if err != nil || string(raw) != wanted {
				t.Fatal("recovery chose the wrong data")
			}
			for _, name := range []string{stage, previous, importJournalPath(dir), filepath.Join(dir, ".import-manifest.json")} {
				if _, err := os.Stat(name); !os.IsNotExist(err) {
					t.Fatalf("recovery left %s", name)
				}
			}
		})
	}
}

func TestImportRecoveryPreservesCopiesWhenCommittedDataIsDamaged(t *testing.T) {
	dir, stage, previous := importDirectoriesForTest(t)
	if err := writeImportJournal(dir, importJournal{Version: 1, Stage: stage, Previous: previous}); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(dir, previous); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(stage, dir); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "db.json"), []byte("damaged"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := recoverImport(dir); err == nil {
		t.Fatal("damaged committed import passed recovery")
	}
	if raw, err := os.ReadFile(filepath.Join(previous, "db.json")); err != nil || string(raw) != "data" {
		t.Fatal("old copy was deleted despite damage")
	}
}

func TestImportRecoveryRejectsUnsafeJournalPaths(t *testing.T) {
	dir, stage, previous := importDirectoriesForTest(t)
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "keep"), []byte("safe"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := writeImportJournal(dir, importJournal{Version: 1, Stage: outside, Previous: previous}); err != nil {
		t.Fatal(err)
	}
	if err := recoverImport(dir); err == nil {
		t.Fatal("unsafe journal accepted")
	}
	if _, err := os.Stat(filepath.Join(outside, "keep")); err != nil {
		t.Fatal("unsafe journal touched outside data")
	}
	if _, err := os.Stat(stage); err != nil {
		t.Fatal("unsafe journal removed staging")
	}
}

func TestDataDirectoryLock(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "data")
	unlock, err := lockDataDirectory(dir)
	if err != nil {
		t.Fatal(err)
	}
	if release, err := lockDataDirectory(dir); err == nil {
		release()
		unlock()
		t.Fatal("second data writer acquired the same lock")
	}
	unlock()
	release, err := lockDataDirectory(dir)
	if err != nil {
		t.Fatal("lock was not released", err)
	}
	release()
}

func TestAbandonedImportCleanupIsRestrictedToOwnedStaging(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "data")
	owned := filepath.Join(root, ".data-import-123")
	unmarked := filepath.Join(root, ".data-import-other")
	for _, path := range []string{owned, unmarked} {
		if err := os.Mkdir(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(owned, ".inventory-staging"), []byte(appID), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := cleanupAbandonedImports(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(owned); !os.IsNotExist(err) {
		t.Fatal("abandoned import was not cleaned")
	}
	if _, err := os.Stat(unmarked); err != nil {
		t.Fatal("cleanup touched an unowned directory")
	}
}
