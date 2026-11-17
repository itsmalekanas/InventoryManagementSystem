package main

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestArchiveExcludesDataAndPreservesExecutablePermissions(t *testing.T) {
	folder := filepath.Join(t.TempDir(), "Portable app with spaces")
	if err := os.MkdirAll(filepath.Join(folder, "data"), 0755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"inventory", "start.sh", "README.txt", "icon.png", "data/db.json", "launcher.log"} {
		if err := os.WriteFile(filepath.Join(folder, name), []byte("synthetic fixture"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	archive := filepath.Join(t.TempDir(), "test.tar.gz")
	if err := writeArchive(folder, archive); err != nil {
		t.Fatal(err)
	}
	file, err := os.Open(archive)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	zipped, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer zipped.Close()
	reader := tar.NewReader(zipped)
	count := 0
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		name := filepath.Base(header.Name)
		switch name {
		case "inventory", "start.sh":
			if header.Mode != 0755 {
				t.Fatal("executable bit lost")
			}
		case "README.txt", "icon.png":
		default:
			t.Fatalf("unexpected packaged file: %s", header.Name)
		}
		count++
	}
	if count != 4 {
		t.Fatalf("packaged %d files", count)
	}
}
