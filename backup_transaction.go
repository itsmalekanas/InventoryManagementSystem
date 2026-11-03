package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type importJournal struct {
	Version  int    `json:"version"`
	Stage    string `json:"stage"`
	Previous string `json:"previous"`
}

func canonicalDataDirectory(dir string) (string, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	if filepath.Dir(abs) == abs {
		return "", fmt.Errorf("use a data folder, not a filesystem root")
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", err
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(abs))
	if err != nil {
		return "", err
	}
	abs = filepath.Join(parent, filepath.Base(abs))
	resolved, err := filepath.EvalSymlinks(abs)
	if os.IsNotExist(err) {
		return abs, nil
	}
	if err != nil {
		return "", err
	}
	return resolved, nil
}

func importJournalPath(dir string) string {
	return filepath.Join(filepath.Dir(dir), "."+filepath.Base(dir)+"-import.json")
}

func writeSyncedFile(name string, raw []byte) error {
	file, err := os.OpenFile(name, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := file.Write(raw); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	return file.Close()
}

// The process-level data lock prevents another active import here. Remove only
// marked application staging folders abandoned by a crash before journaling.
func cleanupAbandonedImports(dir string) error {
	entries, err := os.ReadDir(filepath.Dir(dir))
	if err != nil {
		return err
	}
	prefix := "." + filepath.Base(dir) + "-import-"
	for _, entry := range entries {
		if !entry.IsDir() || entry.Type()&os.ModeSymlink != 0 || !strings.HasPrefix(entry.Name(), prefix) {
			continue
		}
		stage := filepath.Join(filepath.Dir(dir), entry.Name())
		marker := filepath.Join(stage, ".inventory-staging")
		info, err := os.Lstat(marker)
		if err != nil || !info.Mode().IsRegular() || info.Size() != int64(len(appID)) {
			continue
		}
		raw, err := os.ReadFile(marker)
		if err == nil && string(raw) == appID {
			if err := os.RemoveAll(stage); err != nil {
				return err
			}
		}
	}
	return nil
}

func verifyImportMarker(dir string) error {
	raw, err := os.ReadFile(filepath.Join(dir, ".import-manifest.json"))
	if err != nil || int64(len(raw)) > maxManifestBytes {
		return fmt.Errorf("import recovery manifest is missing or invalid")
	}
	var manifest backupManifest
	if err := decodeBackupJSON(raw, &manifest); err != nil {
		return err
	}
	if manifest.App != appID || manifest.Format != backupFormat {
		return fmt.Errorf("invalid import recovery format")
	}
	if len(manifest.Files) < 1 || len(manifest.Files) > maxBackupFiles {
		return fmt.Errorf("invalid recovery file list")
	}
	hasDB := false
	for _, entry := range manifest.Files {
		if !backupPathAllowed(entry.Path) || entry.Size < 0 || entry.Size > backupEntryLimit(entry.Path) {
			return fmt.Errorf("invalid import recovery file")
		}
		if entry.Path == "db.json" {
			hasDB = true
		}
	}
	if !hasDB {
		return fmt.Errorf("recovery manifest has no database")
	}
	return verifyStagedBackup(dir, manifest)
}

func writeImportJournal(dir string, journal importJournal) error {
	raw, err := json.Marshal(journal)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(dir), ".inventory-journal-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err := file.Write(raw); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(name, importJournalPath(dir)); err != nil {
		return err
	}
	return syncDirectory(filepath.Dir(dir))
}

func installImport(dir, stage string, rename func(string, string) error) error {
	if filepath.Dir(dir) == dir {
		return fmt.Errorf("cannot replace a filesystem root")
	}
	if _, err := os.Lstat(importJournalPath(dir)); !os.IsNotExist(err) {
		return fmt.Errorf("an earlier import needs recovery; restart the app first")
	}
	previous := filepath.Join(filepath.Dir(dir), "."+filepath.Base(dir)+"-previous-"+newID())
	journal := importJournal{Version: 1, Stage: stage, Previous: previous}
	if err := writeImportJournal(dir, journal); err != nil {
		return fmt.Errorf("prepare import journal: %w", err)
	}
	if err := rename(dir, previous); err != nil {
		os.Remove(importJournalPath(dir))
		return fmt.Errorf("could not move current data; it was left unchanged: %w", err)
	}
	if err := rename(stage, dir); err != nil {
		if restoreErr := rename(previous, dir); restoreErr != nil {
			return fmt.Errorf("import was interrupted; restart the app to recover the original data: %v (restore: %v)", err, restoreErr)
		}
		os.Remove(importJournalPath(dir))
		return fmt.Errorf("import failed; original data was restored: %w", err)
	}
	// The new directory is now committed. If cleanup is interrupted or blocked,
	// leave the journal; startup finishes cleanup rather than undoing a success.
	if syncDirectory(filepath.Dir(dir)) == nil && os.RemoveAll(previous) == nil {
		os.Remove(importJournalPath(dir))
		os.Remove(filepath.Join(dir, ".import-manifest.json"))
		os.Remove(filepath.Join(dir, ".inventory-staging"))
		syncDirectory(filepath.Dir(dir))
	}
	return nil
}

func recoverImport(dir string) error {
	path := importJournalPath(dir)
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	var journal importJournal
	if len(raw) > 8192 || decodeBackupJSON(raw, &journal) != nil || journal.Version != 1 {
		return fmt.Errorf("invalid import recovery journal: %s", path)
	}
	parent := filepath.Dir(dir)
	validSibling := func(name, prefix string) bool {
		return filepath.IsAbs(name) && filepath.Clean(name) == name && filepath.Dir(name) == parent && strings.HasPrefix(filepath.Base(name), "."+filepath.Base(dir)+prefix) && name != dir
	}
	if !validSibling(journal.Stage, "-import-") || !validSibling(journal.Previous, "-previous-") {
		return fmt.Errorf("unsafe paths in import recovery journal")
	}
	exists := func(name string) (bool, error) {
		info, err := os.Lstat(name)
		if os.IsNotExist(err) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return false, fmt.Errorf("invalid import recovery directory: %s", name)
		}
		return true, nil
	}
	active, err := exists(dir)
	if err != nil {
		return err
	}
	stage, err := exists(journal.Stage)
	if err != nil {
		return err
	}
	previous, err := exists(journal.Previous)
	if err != nil {
		return err
	}
	switch {
	case active && stage && !previous: // journal written; first rename never happened
		if err := os.RemoveAll(journal.Stage); err != nil {
			return err
		}
	case !active && previous: // first rename happened; roll back to the original data
		if err := os.Rename(journal.Previous, dir); err != nil {
			return err
		}
		if stage {
			if err := os.RemoveAll(journal.Stage); err != nil {
				return err
			}
		}
	case active && !stage && previous: // new directory committed; finish cleanup
		if err := verifyImportMarker(dir); err != nil {
			return fmt.Errorf("committed import could not be verified; all copies were preserved (original: %s): %w", journal.Previous, err)
		}
		if err := os.RemoveAll(journal.Previous); err != nil {
			return err
		}
	case active && !stage && !previous: // cleanup already completed
	default:
		return fmt.Errorf("ambiguous import recovery state; all copies were preserved beside %s", dir)
	}
	if err := os.Remove(path); err != nil {
		return err
	}
	os.Remove(filepath.Join(dir, ".import-manifest.json"))
	os.Remove(filepath.Join(dir, ".inventory-staging"))
	return syncDirectory(parent)
}
