package main

import (
	"net/http"
	"sync"
)

// Stop admitting work, drain admitted requests, then acknowledge the exit.
// The exit handler is outside the active group so it can wait without deadlock.
type appLifecycle struct {
	store   *Store
	exit    chan struct{}
	mu      sync.Mutex
	closing bool
	active  sync.WaitGroup
}

func newAppLifecycle(store *Store) *appLifecycle {
	return &appLifecycle{store: store, exit: make(chan struct{})}
}

func (life *appLifecycle) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/api/exit" {
			life.requestExit(w, r)
			return
		}
		life.mu.Lock()
		if life.closing {
			life.mu.Unlock()
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "err.exiting"})
			return
		}
		life.active.Add(1)
		life.mu.Unlock()
		defer life.active.Done()
		next.ServeHTTP(w, r)
	})
}

func (life *appLifecycle) requestExit(w http.ResponseWriter, r *http.Request) {
	var in struct{}
	if err := readJSON(r, &in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "err.badRequest"})
		return
	}
	check := func() error {
		life.store.mu.Lock()
		defer life.store.mu.Unlock()
		if r.Header.Get("X-Inventory-Generation") != life.store.generation {
			return &apiError{http.StatusConflict, "err.dataReplaced"}
		}
		return nil
	}
	if err := check(); err != nil {
		backupError(w, err)
		return
	}
	life.mu.Lock()
	if life.closing {
		life.mu.Unlock()
		writeJSON(w, http.StatusConflict, map[string]string{"error": "err.exiting"})
		return
	}
	life.closing = true
	life.mu.Unlock()
	life.active.Wait()
	// An admitted import may have replaced the data while we drained requests.
	if err := check(); err != nil {
		life.mu.Lock()
		life.closing = false
		life.mu.Unlock()
		backupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"closed": true})
	close(life.exit)
}
