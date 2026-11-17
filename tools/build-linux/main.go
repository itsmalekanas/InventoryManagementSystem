// Builds portable, static Linux packages without touching any shop data.
package main

import (
	"archive/tar"
	"compress/gzip"
	"debug/elf"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	out := flag.String("out", "dist", "output directory")
	flag.Parse()
	if err := build(*out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func build(out string) error {
	const arch = "amd64"
	raw, err := os.ReadFile("VERSION")
	if err != nil {
		return err
	}
	version := strings.TrimSpace(string(raw))
	if !regexp.MustCompile(`^v[0-9]+\.[0-9]+\.[0-9]+$`).MatchString(version) {
		return fmt.Errorf("invalid VERSION")
	}
	folder := filepath.Join(out, "Inventory Management System "+version+" linux-"+arch)
	if err := os.MkdirAll(folder, 0755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(folder, ".inventory-build-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	tmp.Close()
	defer os.Remove(name)
	cmd := exec.Command("go", "build", "-trimpath", "-ldflags", "-s -w", "-o", name, ".")
	// Remove inherited duplicates, which can otherwise select the wrong target.
	for _, entry := range os.Environ() {
		key := strings.ToUpper(strings.SplitN(entry, "=", 2)[0])
		if key != "GOOS" && key != "GOARCH" && key != "CGO_ENABLED" {
			cmd.Env = append(cmd.Env, entry)
		}
	}
	cmd.Env = append(cmd.Env, "GOOS=linux", "GOARCH="+arch, "CGO_ENABLED=0")
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}
	binary, err := elf.Open(name)
	if err != nil {
		return err
	}
	for _, program := range binary.Progs {
		if program.Type == elf.PT_INTERP {
			binary.Close()
			return fmt.Errorf("Linux executable unexpectedly needs a dynamic loader")
		}
	}
	binary.Close()
	if err := os.Chmod(name, 0755); err != nil {
		return err
	}
	// Rename only the generated executable. Never remove or package a data folder.
	if err := os.Rename(name, filepath.Join(folder, "inventory")); err != nil {
		return err
	}
	for _, file := range []struct {
		source, target string
		mode           os.FileMode
	}{
		{"packaging/linux/start.sh", "start.sh", 0755},
		{"packaging/linux/README.txt", "README.txt", 0644},
		{"assets/app.png", "icon.png", 0644},
	} {
		content, err := os.ReadFile(file.source)
		if err != nil {
			return err
		}
		if file.target != "icon.png" {
			content = []byte(strings.ReplaceAll(string(content), "\r\n", "\n"))
		}
		if err := os.WriteFile(filepath.Join(folder, file.target), content, file.mode); err != nil {
			return err
		}
		if err := os.Chmod(filepath.Join(folder, file.target), file.mode); err != nil {
			return err
		}
	}
	archive := filepath.Join(out, "InventoryManagementSystem-"+version+"-linux-"+arch+".tar.gz")
	if err := writeArchive(folder, archive); err != nil {
		return err
	}
	fmt.Println(archive)
	return nil
}

func writeArchive(folder, target string) (err error) {
	file, err := os.Create(target)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := file.Close(); err == nil {
			err = closeErr
		}
	}()
	zipped := gzip.NewWriter(file)
	defer func() {
		if closeErr := zipped.Close(); err == nil {
			err = closeErr
		}
	}()
	writer := tar.NewWriter(zipped)
	defer func() {
		if closeErr := writer.Close(); err == nil {
			err = closeErr
		}
	}()
	// Explicit allowlist: existing shop files can never enter a release archive.
	for _, name := range []string{"inventory", "start.sh", "README.txt", "icon.png"} {
		input, openErr := os.Open(filepath.Join(folder, name))
		if openErr != nil {
			return openErr
		}
		info, statErr := input.Stat()
		if statErr != nil {
			input.Close()
			return statErr
		}
		mode := int64(0644)
		if name == "inventory" || name == "start.sh" {
			mode = 0755
		}
		header := &tar.Header{Name: filepath.Base(folder) + "/" + name, Mode: mode, Size: info.Size(), Typeflag: tar.TypeReg}
		if err = writer.WriteHeader(header); err == nil {
			_, err = io.Copy(writer, input)
		}
		input.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
