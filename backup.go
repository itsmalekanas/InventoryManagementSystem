package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	backupFormat            = 1
	maxBackupBytes    int64 = 2 << 30
	maxExpandedBackup int64 = 4 << 30
	maxBackupDB       int64 = 256 << 20
	maxBackupFiles          = 10000
	maxManifestBytes  int64 = 2 << 20
	transferLifetime        = 30 * time.Minute
)

type backupEntry struct {
	Path   string `json:"path"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

type backupManifest struct {
	App       string        `json:"app"`
	Format    int           `json:"format"`
	CreatedAt string        `json:"createdAt"`
	Files     []backupEntry `json:"files"`
}

type backupTransfer struct {
	path       string
	db         DB
	manifest   backupManifest
	generation string
	revision   uint64
	expires    time.Time
	export     bool
}

var backupFileName = regexp.MustCompile(`^(db-[0-9]{4}-[0-9]{2}-[0-9]{2}\.json|before-import-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}\.zip)$`)

func backupPathAllowed(name string) bool {
	if name == "db.json" {
		return true
	}
	if strings.HasPrefix(name, "images/") {
		return validImageName(strings.TrimPrefix(name, "images/"))
	}
	if strings.HasPrefix(name, "backups/") {
		return backupFileName.MatchString(strings.TrimPrefix(name, "backups/"))
	}
	return false
}

func backupError(w http.ResponseWriter, err error) {
	var ae *apiError
	if errors.As(err, &ae) {
		writeJSON(w, ae.Status, map[string]string{"error": ae.Key})
		return
	}
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.backup", "detail": err.Error()})
}

func (s *Store) checkGenerationLocked(r *http.Request) error {
	if s.importBroken {
		return &apiError{http.StatusServiceUnavailable, "err.importRecovery"}
	}
	if _, err := os.Stat(importJournalPath(s.dir)); err == nil {
		if err := recoverImport(s.dir); err != nil {
			return &apiError{http.StatusServiceUnavailable, "err.importRecovery"}
		}
	}
	if value := r.Header.Get("X-Inventory-Generation"); value != s.generation {
		return &apiError{http.StatusConflict, "err.dataReplaced"}
	}
	return nil
}

func (s *Store) backupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/backups/export", s.prepareExport)
	mux.HandleFunc("GET /api/backups/download/{token}", s.downloadBackup)
	mux.HandleFunc("POST /api/backups/import/preview", s.previewImport)
	mux.HandleFunc("POST /api/backups/import/commit", s.commitImport)
	mux.HandleFunc("DELETE /api/backups/import/{token}", s.cancelImport)
}

func (s *Store) beginBackupWork(w http.ResponseWriter) bool {
	select {
	case s.backupWork <- struct{}{}:
		return true
	default:
		backupError(w, &apiError{http.StatusTooManyRequests, "err.backupBusy"})
		return false
	}
}

func (s *Store) rememberTransferLocked(item *backupTransfer) (string, error) {
	if len(s.transfers) >= 4 {
		return "", fmt.Errorf("too many pending transfers; finish or cancel one first")
	}
	token := newID() + newID()
	item.expires = time.Now().Add(transferLifetime)
	s.transfers[token] = item
	time.AfterFunc(transferLifetime, func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		if current := s.transfers[token]; current == item {
			s.removeTransferLocked(token)
		}
	})
	return token, nil
}

func (s *Store) removeTransferLocked(token string) {
	if item := s.transfers[token]; item != nil {
		os.RemoveAll(item.path) // only internally generated temp file/directory paths
		delete(s.transfers, token)
	}
}

func (s *Store) cleanupTransfers() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for token := range s.transfers {
		s.removeTransferLocked(token)
	}
}

func (s *Store) prepareExport(w http.ResponseWriter, r *http.Request) {
	var request struct{}
	if err := readJSON(r, &request); err != nil {
		backupError(w, err)
		return
	}
	if !s.beginBackupWork(w) {
		return
	}
	defer func() { <-s.backupWork }()
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.checkGenerationLocked(r); err != nil {
		backupError(w, err)
		return
	}
	if len(s.transfers) >= 4 {
		backupError(w, fmt.Errorf("finish or cancel a pending transfer first"))
		return
	}
	file, err := os.CreateTemp("", "inventory-export-*.zip")
	if err != nil {
		backupError(w, err)
		return
	}
	name := file.Name()
	file.Close()
	manifest, err := s.writeBackupLocked(name)
	if err != nil {
		os.Remove(name)
		backupError(w, err)
		return
	}
	token, err := s.rememberTransferLocked(&backupTransfer{path: name, export: true})
	if err != nil {
		os.Remove(name)
		backupError(w, err)
		return
	}
	info, err := os.Stat(name)
	if err != nil {
		s.removeTransferLocked(token)
		backupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "filename": "InventoryBackup-" + time.Now().UTC().Format("20060102T150405Z") + ".zip", "bytes": info.Size(), "summary": backupSummary(s.db, manifest)})
}

func (s *Store) downloadBackup(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	token := r.PathValue("token")
	item := s.transfers[token]
	if item == nil || !item.export || time.Now().After(item.expires) {
		s.mu.Unlock()
		http.NotFound(w, r)
		return
	}
	file, err := os.Open(item.path)
	if err != nil {
		s.mu.Unlock()
		backupError(w, err)
		return
	}
	// HEAD requests may be sent before a browser actually downloads the file.
	// They must not consume its token or remove the prepared ZIP.
	consume := r.Method != http.MethodHead
	if consume {
		delete(s.transfers, token)
	}
	s.mu.Unlock()
	if consume {
		defer os.Remove(item.path)
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		backupError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Disposition", `attachment; filename="InventoryBackup-`+time.Now().UTC().Format("20060102T150405Z")+`.zip"`)
	http.ServeContent(w, r, "backup.zip", info.ModTime(), file)
}

func (s *Store) previewImport(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Content-Type") != "application/zip" {
		backupError(w, bad("err.badRequest"))
		return
	}
	if !s.beginBackupWork(w) {
		return
	}
	defer func() { <-s.backupWork }()
	s.mu.Lock()
	checkErr := s.checkGenerationLocked(r)
	full := len(s.transfers) >= 4
	s.mu.Unlock()
	if checkErr != nil {
		backupError(w, checkErr)
		return
	}
	if full {
		backupError(w, fmt.Errorf("finish or cancel a pending transfer first"))
		return
	}
	file, err := os.CreateTemp("", "inventory-upload-*.zip")
	if err != nil {
		backupError(w, err)
		return
	}
	defer os.Remove(file.Name())
	_, err = io.Copy(file, http.MaxBytesReader(w, r.Body, maxBackupBytes))
	closeErr := file.Close()
	if err != nil || closeErr != nil {
		backupError(w, fmt.Errorf("upload failed or exceeds the 2 GiB backup limit"))
		return
	}
	// Extraction stays beside the data directory, on the same filesystem as the
	// eventual rename. No live data is touched during upload or validation.
	stage, err := os.MkdirTemp(filepath.Dir(s.dir), "."+filepath.Base(s.dir)+"-import-")
	if err != nil {
		backupError(w, err)
		return
	}
	keep := false
	defer func() {
		if !keep {
			os.RemoveAll(stage)
		}
	}()
	if err := writeSyncedFile(filepath.Join(stage, ".inventory-staging"), []byte(appID)); err != nil {
		backupError(w, err)
		return
	}
	db, manifest, err := readBackup(file.Name(), stage)
	if err != nil {
		backupError(w, err)
		return
	}
	for _, name := range []string{"images", "backups"} {
		if err := os.MkdirAll(filepath.Join(stage, name), 0o755); err != nil {
			backupError(w, err)
			return
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.checkGenerationLocked(r); err != nil {
		backupError(w, err)
		return
	}
	token, err := s.rememberTransferLocked(&backupTransfer{path: stage, db: db, manifest: manifest, generation: s.generation, revision: s.revision})
	if err != nil {
		backupError(w, err)
		return
	}
	keep = true
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "summary": backupSummary(db, manifest)})
}

func (s *Store) cancelImport(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.checkGenerationLocked(r); err != nil {
		backupError(w, err)
		return
	}
	token := r.PathValue("token")
	if item := s.transfers[token]; item != nil && !item.export {
		s.removeTransferLocked(token)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"cancelled": true})
}

func (s *Store) commitImport(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Token string `json:"token"`
	}
	if err := readJSON(r, &request); err != nil {
		backupError(w, err)
		return
	}
	if !s.beginBackupWork(w) {
		return
	}
	defer func() { <-s.backupWork }()
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.checkGenerationLocked(r); err != nil {
		backupError(w, err)
		return
	}
	item := s.transfers[request.Token]
	if item == nil || item.export || time.Now().After(item.expires) {
		backupError(w, bad("err.importExpired"))
		return
	}
	if item.generation != s.generation || item.revision != s.revision {
		s.removeTransferLocked(request.Token)
		backupError(w, &apiError{http.StatusConflict, "err.importChanged"})
		return
	}
	// Recheck staged files before committing; staging damage must never become
	// active data. The manifest includes their exact sizes and SHA-256 digests.
	if err := verifyStagedBackup(item.path, item.manifest); err != nil {
		backupError(w, err)
		return
	}
	recoveryName := "before-import-" + time.Now().UTC().Format("20060102T150405Z") + "-" + newID() + ".zip"
	// Keep recovery archives beside data, rather than recursively nesting old
	// full backups inside every future export.
	recoveryDir := filepath.Join(filepath.Dir(s.dir), filepath.Base(s.dir)+"-recovery")
	if err := os.MkdirAll(recoveryDir, 0o700); err != nil {
		backupError(w, err)
		return
	}
	recoveryPath := filepath.Join(recoveryDir, recoveryName)
	if _, err := s.writeBackupLocked(recoveryPath); err != nil {
		os.Remove(recoveryPath)
		backupError(w, err)
		return
	}
	marker, err := json.Marshal(item.manifest)
	if err != nil {
		backupError(w, err)
		return
	}
	if err := writeSyncedFile(filepath.Join(item.path, ".import-manifest.json"), marker); err != nil {
		backupError(w, err)
		return
	}
	for _, directory := range []string{filepath.Join(item.path, "images"), filepath.Join(item.path, "backups"), item.path, recoveryDir} {
		if err := syncDirectory(directory); err != nil {
			backupError(w, err)
			return
		}
	}
	// This journal makes an interrupted directory swap recoverable at startup.
	if err := installImport(s.dir, item.path, os.Rename); err != nil {
		if _, statErr := os.Stat(s.file); statErr != nil {
			s.importBroken = true
		}
		backupError(w, err)
		return
	}
	delete(s.transfers, request.Token)
	s.db, s.generation = item.db, newID()
	s.revision++
	result := s.payloadLocked()
	result["recoveryBackup"] = recoveryPath
	writeJSON(w, http.StatusOK, result)
}

func backupSummary(db DB, manifest backupManifest) map[string]any {
	images, backups := 0, 0
	for _, entry := range manifest.Files {
		if strings.HasPrefix(entry.Path, "images/") {
			images++
		}
		if strings.HasPrefix(entry.Path, "backups/") {
			backups++
		}
	}
	return map[string]any{"storeName": db.Settings.StoreName, "createdAt": manifest.CreatedAt, "products": len(db.Products), "customers": len(db.Customers), "invoices": len(db.Invoices), "images": images, "backups": backups}
}

// Caller holds s.mu throughout snapshot creation, including image operations.
func (s *Store) writeBackupLocked(destination string) (backupManifest, error) {
	manifest := backupManifest{App: appID, Format: backupFormat, CreatedAt: time.Now().UTC().Format(time.RFC3339), Files: []backupEntry{}}
	raw, err := json.MarshalIndent(s.db, "", "  ")
	if err != nil {
		return manifest, err
	}
	names := []string{}
	for _, dir := range []string{"images", "backups"} {
		entries, err := os.ReadDir(filepath.Join(s.dir, dir))
		if err != nil {
			return manifest, err
		}
		for _, entry := range entries {
			name := dir + "/" + entry.Name()
			if !entry.Type().IsRegular() || !backupPathAllowed(name) {
				return manifest, fmt.Errorf("unsupported backup file: %s", name)
			}
			names = append(names, name)
		}
	}
	sort.Strings(names)
	if len(names)+1 > maxBackupFiles {
		return manifest, fmt.Errorf("backup exceeds %d files", maxBackupFiles)
	}
	file, err := os.OpenFile(destination, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0o600)
	if err != nil {
		return manifest, err
	}
	defer file.Close()
	writer := zip.NewWriter(file)
	var total int64
	add := func(name string, source io.Reader) error {
		entryWriter, err := writer.Create(name)
		if err != nil {
			return err
		}
		hash := sha256.New()
		limit := backupEntryLimit(name)
		n, err := io.Copy(io.MultiWriter(entryWriter, hash), io.LimitReader(source, limit+1))
		if err != nil {
			return err
		}
		total += n
		if n > limit || total > maxExpandedBackup {
			return fmt.Errorf("backup exceeds supported size limits")
		}
		manifest.Files = append(manifest.Files, backupEntry{Path: name, Size: n, SHA256: hex.EncodeToString(hash.Sum(nil))})
		return nil
	}
	if err := add("db.json", bytes.NewReader(raw)); err != nil {
		writer.Close()
		return manifest, err
	}
	for _, name := range names {
		source, err := os.Open(filepath.Join(s.dir, filepath.FromSlash(name)))
		if err != nil {
			writer.Close()
			return manifest, err
		}
		err = add(name, source)
		source.Close()
		if err != nil {
			writer.Close()
			return manifest, err
		}
	}
	metadata, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil || int64(len(metadata)) > maxManifestBytes {
		writer.Close()
		return manifest, fmt.Errorf("backup manifest is too large")
	}
	entry, err := writer.Create("manifest.json")
	if err != nil {
		writer.Close()
		return manifest, err
	}
	if _, err := entry.Write(metadata); err != nil {
		writer.Close()
		return manifest, err
	}
	if err := writer.Close(); err != nil {
		return manifest, err
	}
	if err := file.Sync(); err != nil {
		return manifest, err
	}
	if err := file.Close(); err != nil {
		return manifest, err
	}
	// Verify what actually reached disk before offering it for download or using
	// it as the pre-import recovery copy.
	_, _, err = readBackup(destination, "")
	return manifest, err
}

func backupEntryLimit(name string) int64 {
	if name == "db.json" {
		return maxBackupDB
	}
	if strings.HasPrefix(name, "images/") {
		return 15 << 20
	}
	return maxBackupBytes
}
