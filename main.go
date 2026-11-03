// Inventory Management System is a small, portable inventory and sales app for a shop.
//
// It is one program file. When started it serves the web pages on this
// computer only (127.0.0.1), opens the browser, and keeps all data in a
// "data" folder next to the program, so the whole app can be copied to
// another computer or a USB stick.
package main

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Keep this identifier stable for existing backups and instance detection.
const appID = "inventory-app"
const appName = "Inventory Management System"

// Application release version, separate from the database/backup format.
//
//go:embed VERSION
var versionFile string

var appVersion = strings.TrimSpace(versionFile)

//go:embed web
var webFiles embed.FS

func main() {
	port := flag.Int("port", 8750, "port to use on this computer")
	dataFlag := flag.String("data", "", "data folder (default: \"data\" next to the program)")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser")
	noTray := flag.Bool("no-tray", false, "run in the foreground without a tray icon")
	version := flag.Bool("version", false, "show the app version and exit")
	flag.Parse()
	if *version {
		fmt.Println(appName + " " + appVersion)
		return
	}

	dataDir := *dataFlag
	if dataDir == "" {
		dataDir = filepath.Join(appDir(), "data")
	}

	dataDir, err := canonicalDataDirectory(dataDir)
	if err != nil {
		fail(err)
	}
	buildID, err := currentBuildID()
	if err != nil {
		fail(err)
	}
	// Reuse only the same build serving this exact data folder. Different shop
	// folders may run side by side, while a version conflict gets a clear error.
	url, err := runningURL(*port, dataDir, buildID)
	if err != nil {
		fail(err)
	}
	if url != "" {
		fmt.Println("The app is already running:", url)
		if !*noBrowser {
			openBrowser(url)
		}
		return
	}
	unlock, err := lockDataDirectory(dataDir)
	if err != nil {
		fail(err)
	}
	defer unlock()

	ln, err := listen(*port)
	if err != nil {
		fail(err)
	}
	defer ln.Close()
	store, err := OpenStore(dataDir)
	if err != nil {
		fail(err)
	}
	defer store.cleanupTransfers()
	url = fmt.Sprintf("http://%s/", ln.Addr().String())

	mux := http.NewServeMux()
	store.routes(mux)
	static, _ := fs.Sub(webFiles, "web")
	fileServer := http.FileServer(http.FS(static))
	mux.Handle("GET /", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/vendor/") {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fileServer.ServeHTTP(w, r)
	}))

	fmt.Println("==============================================")
	fmt.Println(" " + appName + " " + appVersion + " is running")
	fmt.Println(" Open:  ", url)
	fmt.Println(" Data:  ", dataDir)
	fmt.Println(" Use the tray menu to open or exit the app on Windows.")
	fmt.Println(" Foreground mode: press Ctrl+C to stop the app.")
	fmt.Println("==============================================")

	if !*noBrowser {
		go func() {
			time.Sleep(300 * time.Millisecond)
			openBrowser(url)
		}()
	}
	server := &http.Server{Handler: localOnly(mux), ReadHeaderTimeout: 10 * time.Second}
	if *noTray {
		err = serveForeground(server, ln)
	} else {
		err = serveDesktop(server, ln, url)
	}
	if err != nil {
		fail(err)
	}
}

func serveForeground(server *http.Server, ln net.Listener) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.Serve(ln) }()
	select {
	case err := <-done:
		if err != http.ErrServerClosed {
			return err
		}
		return nil
	case <-ctx.Done():
		return server.Shutdown(context.Background())
	}
}

// appDir is the folder that holds the program file. When run with
// "go run" the program lives in a temp folder, so the current folder is used.
func appDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	exe, _ = filepath.EvalSymlinks(exe)
	dir := filepath.Dir(exe)
	if strings.Contains(dir, "go-build") {
		wd, _ := os.Getwd()
		return wd
	}
	return dir
}

// listen tries the chosen port first and then the next ten, so the app
// still starts if another program already uses the port.
func listen(port int) (net.Listener, error) {
	var lastErr error
	for p := port; p <= port+10; p++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ln, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

// localOnly refuses requests whose address is not this computer, which
// stops other web sites from reaching the app through DNS tricks.
func localOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.Host)
		if err != nil {
			host = r.Host
		}
		if host != "127.0.0.1" && host != "localhost" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type instanceIdentity struct {
	App     string `json:"app"`
	DataDir string `json:"dataDir"`
	BuildID string `json:"buildId"`
	Version string `json:"version,omitempty"`
}

var buildIdentityOnce sync.Once
var buildIdentity string
var buildIdentityError error

func currentBuildID() (string, error) {
	buildIdentityOnce.Do(func() {
		executable, err := os.Executable()
		if err != nil {
			buildIdentityError = err
			return
		}
		file, err := os.Open(executable)
		if err != nil {
			buildIdentityError = err
			return
		}
		defer file.Close()
		hash := sha256.New()
		if _, err := io.Copy(hash, file); err != nil {
			buildIdentityError = err
			return
		}
		buildIdentity = fmt.Sprintf("%x", hash.Sum(nil))
	})
	return buildIdentity, buildIdentityError
}

func probeInstance(port int) (instanceIdentity, bool) {
	var identity instanceIdentity
	client := http.Client{Timeout: 700 * time.Millisecond}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/api/ping", port))
	if err != nil {
		return identity, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&identity) != nil {
		return identity, false
	}
	return identity, identity.App == appID
}

// Include fallback ports so reopening a tray app does not start a second copy
// when its preferred port is occupied. Port zero requests a separate test server.
func runningURL(port int, dataDir, buildID string) (string, error) {
	if port == 0 {
		return "", nil
	}
	for p := port; p <= port+10; p++ {
		identity, found := probeInstance(p)
		if !found {
			continue
		}
		if identity.DataDir == "" || identity.BuildID == "" {
			return "", fmt.Errorf("an older version of %s is running on port %d; exit it from its tray menu (or close its console window), then start this copy again", appName, p)
		}
		same := filepath.Clean(identity.DataDir) == filepath.Clean(dataDir)
		if runtime.GOOS == "windows" {
			same = strings.EqualFold(filepath.Clean(identity.DataDir), filepath.Clean(dataDir))
		}
		if !same {
			continue
		}
		if identity.BuildID != buildID {
			return "", fmt.Errorf("another version is already using %s; exit that app before starting this version", dataDir)
		}
		return fmt.Sprintf("http://127.0.0.1:%d/", p), nil
	}
	return "", nil
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	prepareBrowserCommand(cmd)
	// Start before returning: a second app instance exits immediately after
	// opening the already-running app, so a goroutine could be cut off too soon.
	if err := cmd.Start(); err != nil {
		showAppError(fmt.Errorf("open this address in your browser: %s (%v)", url, err))
		return
	}
	go cmd.Wait()
}

func fail(err error) {
	showAppError(err)
	os.Exit(1)
}
