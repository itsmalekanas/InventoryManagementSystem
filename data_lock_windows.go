//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

// The lock is outside data, so it stays held while importing replaces data.
func lockDataDirectory(dir string) (func(), error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return nil, err
	}
	name := filepath.Join(filepath.Dir(abs), "."+filepath.Base(abs)+".lock")
	handle, err := syscall.CreateFile(syscall.StringToUTF16Ptr(name), syscall.GENERIC_READ|syscall.GENERIC_WRITE, 0, nil, syscall.OPEN_ALWAYS, syscall.FILE_ATTRIBUTE_HIDDEN, 0)
	if err != nil {
		return nil, fmt.Errorf("cannot lock the data folder; close any other app using it: %w", err)
	}
	return func() { syscall.CloseHandle(handle) }, nil
}

// Windows does not support fsync on directory handles. The import journal and
// each file are flushed separately; directory renames are journal-recoverable.
func syncDirectory(dir string) error { return nil }
