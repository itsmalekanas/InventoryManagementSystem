//go:build !windows

package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
)

// Keep Linux/macOS builds dependency-free. A native tray can be added for those
// desktops later; for now they retain the browser and foreground server.
func serveDesktop(server *http.Server, ln net.Listener, url string, exit <-chan struct{}) error {
	return serveForeground(server, ln, exit)
}

func prepareBrowserCommand(cmd *exec.Cmd) {}

func showAppError(err error) { fmt.Fprintln(os.Stderr, appName+" "+appVersion+":", err) }
