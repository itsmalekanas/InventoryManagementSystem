//go:build linux

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLinuxBrowserFallbacks(t *testing.T) {
	for _, name := range []string{"firefox-esr", "xdg-open", "gio"} {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			capture := filepath.Join(dir, "args")
			if err := os.WriteFile(filepath.Join(dir, name), []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$BROWSER_TEST_CAPTURE\"\n"), 0755); err != nil {
				t.Fatal(err)
			}
			t.Setenv("PATH", dir)
			t.Setenv("BROWSER_TEST_CAPTURE", capture)
			url := "http://127.0.0.1:8750/"
			openBrowser(url)
			deadline := time.Now().Add(3 * time.Second)
			for {
				raw, err := os.ReadFile(capture)
				if err == nil && strings.Contains(string(raw), url) {
					break
				}
				if time.Now().After(deadline) {
					t.Fatalf("%s did not receive URL", name)
				}
				time.Sleep(10 * time.Millisecond)
			}
		})
	}
}
