package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func sendExit(t *testing.T, server *httptest.Server, generation string) int {
	t.Helper()
	req, _ := http.NewRequest("POST", server.URL+"/api/exit", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Inventory-Generation", generation)
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Error(err)
		return 0
	}
	defer response.Body.Close()
	if response.StatusCode == 200 {
		var result struct {
			Closed bool `json:"closed"`
		}
		if json.NewDecoder(response.Body).Decode(&result) != nil || !result.Closed {
			t.Error("exit did not acknowledge drained requests")
		}
	}
	return response.StatusCode
}

func TestWebExitDrainsActiveSaves(t *testing.T) {
	_, store, dir := newTestServer(t)
	life := newAppLifecycle(store)
	mux := http.NewServeMux()
	store.routes(mux)
	started, release := make(chan struct{}), make(chan struct{})
	mux.HandleFunc("POST /slow-save", func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		store.saveProduct(w, r)
	})
	server := httptest.NewServer(life.wrap(mux))
	defer server.Close()
	generation := store.generation
	saved := make(chan int, 1)
	go func() {
		code, _ := call(t, server, "POST", "/slow-save", Product{Name: "Saved during exit", Price: 100, Stock: 3})
		saved <- code
	}()
	<-started
	if status := sendExit(t, server, "stale"); status != 409 {
		t.Fatal("stale exit accepted", status)
	}
	closed := make(chan int, 1)
	go func() { closed <- sendExit(t, server, generation) }()
	deadline := time.Now().Add(3 * time.Second)
	for {
		life.mu.Lock()
		closing := life.closing
		life.mu.Unlock()
		if closing {
			break
		}
		if time.Now().After(deadline) {
			close(release)
			t.Fatal("exit did not begin draining")
		}
		time.Sleep(time.Millisecond)
	}
	response, err := http.Get(server.URL + "/api/data")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 503 {
		t.Fatal("new requests admitted while exiting")
	}
	select {
	case <-life.exit:
		t.Fatal("exit signalled before active save completed")
	default:
	}
	select {
	case <-closed:
		t.Fatal("exit acknowledged before active save completed")
	default:
	}
	close(release)
	if status := <-saved; status != 200 {
		t.Fatal("active save was interrupted", status)
	}
	if status := <-closed; status != 200 {
		t.Fatal("exit failed", status)
	}
	select {
	case <-life.exit:
	default:
		t.Fatal("exit not signalled")
	}
	reopened, err := OpenStore(dir)
	if err != nil || len(reopened.db.Products) != 1 || reopened.db.Products[0].Name != "Saved during exit" {
		t.Fatal("acknowledged exit lost saved data", err)
	}
}

func TestWebExitRequiresJSONAndProtectsImportedGeneration(t *testing.T) {
	_, store, _ := newTestServer(t)
	life := newAppLifecycle(store)
	mux := http.NewServeMux()
	store.routes(mux)
	started, release := make(chan struct{}), make(chan struct{})
	mux.HandleFunc("POST /import-simulation", func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		store.mu.Lock()
		store.generation = newID()
		store.mu.Unlock()
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	server := httptest.NewServer(life.wrap(mux))
	defer server.Close()
	response, err := http.Post(server.URL+"/api/exit", "text/plain", bytes.NewBufferString("{}"))
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 400 {
		t.Fatal("non-JSON exit accepted")
	}
	generation := store.generation
	finished := make(chan struct{})
	go func() {
		response, err := http.Post(server.URL+"/import-simulation", "application/json", bytes.NewBufferString("{}"))
		if err == nil {
			response.Body.Close()
		}
		close(finished)
	}()
	<-started
	closed := make(chan int, 1)
	go func() { closed <- sendExit(t, server, generation) }()
	deadline := time.Now().Add(3 * time.Second)
	for {
		life.mu.Lock()
		closing := life.closing
		life.mu.Unlock()
		if closing {
			break
		}
		if time.Now().After(deadline) {
			close(release)
			t.Fatal("exit did not begin draining")
		}
		time.Sleep(time.Millisecond)
	}
	close(release)
	<-finished
	if code := <-closed; code != 409 {
		t.Fatal("old page exited newly imported data", code)
	}
	select {
	case <-life.exit:
		t.Fatal("invalid exit was signalled")
	default:
	}
	response, err = http.Get(server.URL + "/api/data")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal("failed exit left server unavailable")
	}
}
