//go:build linux

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The CI containers run this against the packaged executable, without Go,
// Firefox, or a desktop installed. Firefox dispatch is recorded by a stub.
func TestLinuxPortableLauncher(t *testing.T) {
	binary := os.Getenv("INVENTORY_LINUX_EXE")
	if binary == "" {
		t.Skip("set INVENTORY_LINUX_EXE to test a built Linux package")
	}
	content, err := os.ReadFile(binary)
	if err != nil {
		t.Fatal(err)
	}
	app := filepath.Join(t.TempDir(), "shop copy with spaces")
	if err := os.MkdirAll(app, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "inventory"), content, 0755); err != nil {
		t.Fatal(err)
	}
	launcher, err := os.ReadFile(filepath.Join(filepath.Dir(binary), "start.sh"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "start.sh"), launcher, 0755); err != nil {
		t.Fatal(err)
	}
	commands := t.TempDir()
	capture := filepath.Join(commands, "browser-args")
	stub := "#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"$INVENTORY_BROWSER_CAPTURE\"\n"
	if err := os.WriteFile(filepath.Join(commands, "firefox"), []byte(stub), 0755); err != nil {
		t.Fatal(err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	url := fmt.Sprintf("http://127.0.0.1:%d", port)
	client := &http.Client{Timeout: time.Second}
	getData := func() (map[string]json.RawMessage, error) {
		res, err := client.Get(url + "/api/data")
		if err != nil {
			return nil, err
		}
		defer res.Body.Close()
		var result map[string]json.RawMessage
		err = json.NewDecoder(res.Body).Decode(&result)
		return result, err
	}
	stop := func() {
		data, err := getData()
		if err != nil {
			return
		}
		var generation string
		json.Unmarshal(data["generation"], &generation)
		req, _ := http.NewRequest("POST", url+"/api/exit", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Inventory-Generation", generation)
		res, err := client.Do(req)
		if err == nil {
			res.Body.Close()
		}
	}
	t.Cleanup(stop)
	launch := func() {
		t.Helper()
		cmd := exec.Command("sh", filepath.Join(app, "start.sh"), "-port", fmt.Sprint(port))
		cmd.Dir = t.TempDir()
		cmd.Env = append(os.Environ(), "PATH="+commands+":"+os.Getenv("PATH"), "INVENTORY_BROWSER_CAPTURE="+capture)
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("launcher: %v %s", err, output)
		}
	}
	launch()
	deadline := time.Now().Add(15 * time.Second)
	for {
		if _, err := getData(); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("app did not start")
		}
		time.Sleep(50 * time.Millisecond)
	}
	if _, err := os.Stat(filepath.Join(app, "data", "db.json")); err != nil {
		t.Fatal("default data not beside executable", err)
	}
	before, err := os.ReadFile(filepath.Join(app, "data", "db.json"))
	if err != nil {
		t.Fatal(err)
	}
	launch() // Must reopen the same copy rather than start a second server.
	after, err := os.ReadFile(filepath.Join(app, "data", "db.json"))
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("reopening changed database")
	}
	args, err := os.ReadFile(capture)
	if err != nil || strings.Count(string(args), "--new-window") != 2 || !strings.Contains(string(args), url) {
		t.Fatalf("Firefox dispatch: %s %v", args, err)
	}
	stop()
	deadline = time.Now().Add(10 * time.Second)
	for {
		if _, err := getData(); err != nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("web Exit did not stop app")
		}
		time.Sleep(50 * time.Millisecond)
	}
	// Wait for shutdown and data lock release, then prove restart preserves data.
	time.Sleep(100 * time.Millisecond)
	launch()
	defer stop()
	after, err = os.ReadFile(filepath.Join(app, "data", "db.json"))
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("restart changed database")
	}
}
