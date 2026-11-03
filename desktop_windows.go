//go:build windows

package main

import (
	"context"
	_ "embed"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"syscall"
	"unsafe"
)

// Native Win32 tray support requires neither CGO nor a desktop runtime.
var (
	trayUser32        = syscall.NewLazyDLL("user32.dll")
	trayShell32       = syscall.NewLazyDLL("shell32.dll")
	trayKernel32      = syscall.NewLazyDLL("kernel32.dll")
	trayDefWindowProc = trayUser32.NewProc("DefWindowProcW")
	trayDestroyWindow = trayUser32.NewProc("DestroyWindow")
	trayPostMessage   = trayUser32.NewProc("PostMessageW")
	trayNotifyIcon    = trayShell32.NewProc("Shell_NotifyIconW")
)

const (
	trayClassName = "InventoryAppTrayWindow"
	trayCallback  = 0x8001 // WM_APP + 1
	trayOpen      = 1
	trayExit      = 2
	wmClose       = 0x0010
	wmDestroy     = 0x0002
	wmCommand     = 0x0111
)

type trayPoint struct{ X, Y int32 }
type trayMessage struct {
	Window         uintptr
	Message        uint32
	WParam, LParam uintptr
	Time           uint32
	Point          trayPoint
	Private        uint32
}
type trayWindowClass struct {
	Size, Style                        uint32
	Proc                               uintptr
	ClassExtra, WindowExtra            int32
	Instance, Icon, Cursor, Background uintptr
	MenuName, ClassName                *uint16
	SmallIcon                          uintptr
}
type trayIconData struct {
	Size                uint32
	Window              uintptr
	ID, Flags, Callback uint32
	Icon                uintptr
	Tip                 [128]uint16
	State, StateMask    uint32
	Info                [256]uint16
	Version             uint32
	InfoTitle           [64]uint16
	InfoFlags           uint32
	GUID                [16]byte
	BalloonIcon         uintptr
}

func trayText(text string) *uint16 { return syscall.StringToUTF16Ptr(text) }

func showAppError(err error) {
	trayUser32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(trayText(err.Error()))), uintptr(unsafe.Pointer(trayText(appName+" "+appVersion))), 0x10)
}

func prepareBrowserCommand(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}

func serveDesktop(server *http.Server, ln net.Listener, url string, exit <-chan struct{}) error {
	// Windows must create and dispatch the tray window on the same OS thread.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	instance, _, _ := trayKernel32.NewProc("GetModuleHandleW").Call(0)
	icon, err := createTrayIcon(instance)
	if err != nil {
		return err
	}
	defer trayUser32.NewProc("DestroyIcon").Call(icon)
	var data trayIconData
	taskbarCreated, _, _ := trayUser32.NewProc("RegisterWindowMessageW").Call(uintptr(unsafe.Pointer(trayText("TaskbarCreated"))))
	addIcon := func() bool {
		data.Version = 0
		ok, _, _ := trayNotifyIcon.Call(0, uintptr(unsafe.Pointer(&data))) // NIM_ADD
		if ok != 0 {
			data.Version = 4
			trayNotifyIcon.Call(4, uintptr(unsafe.Pointer(&data))) // NIM_SETVERSION
		}
		return ok != 0
	}
	windowProc := syscall.NewCallback(func(window uintptr, message uint32, wParam, lParam uintptr) uintptr {
		switch message {
		case trayCallback:
			switch uint32(lParam & 0xffff) {
			case 0x0400, 0x0401: // NIN_SELECT / NIN_KEYSELECT
				openBrowser(url)
			case 0x007b: // WM_CONTEXTMENU
				showTrayMenu(window)
			}
			return 0
		case wmCommand:
			switch wParam & 0xffff {
			case trayOpen:
				openBrowser(url)
			case trayExit:
				trayDestroyWindow.Call(window)
			}
			return 0
		case wmClose:
			trayDestroyWindow.Call(window)
			return 0
		case wmDestroy:
			trayNotifyIcon.Call(2, uintptr(unsafe.Pointer(&data))) // NIM_DELETE
			trayUser32.NewProc("PostQuitMessage").Call(0)
			return 0
		}
		if taskbarCreated != 0 && message == uint32(taskbarCreated) {
			// Explorer recreates the notification area after it restarts.
			addIcon()
			return 0
		}
		result, _, _ := trayDefWindowProc.Call(window, uintptr(message), wParam, lParam)
		return result
	})
	class := trayWindowClass{Proc: windowProc, Instance: instance, ClassName: trayText(trayClassName)}
	class.Size = uint32(unsafe.Sizeof(class))
	if atom, _, err := trayUser32.NewProc("RegisterClassExW").Call(uintptr(unsafe.Pointer(&class))); atom == 0 {
		return fmt.Errorf("create tray window class: %v", err)
	}
	defer trayUser32.NewProc("UnregisterClassW").Call(uintptr(unsafe.Pointer(class.ClassName)), instance)
	// An invisible top-level window receives TaskbarCreated broadcasts too.
	window, _, err := trayUser32.NewProc("CreateWindowExW").Call(0, uintptr(unsafe.Pointer(class.ClassName)), uintptr(unsafe.Pointer(trayText(appName+" "+appVersion))), 0, 0, 0, 0, 0, 0, 0, instance, 0)
	if window == 0 {
		return fmt.Errorf("create tray window: %v", err)
	}
	defer trayDestroyWindow.Call(window)
	desktopDone := make(chan struct{})
	defer close(desktopDone)
	go func() {
		select {
		case <-exit:
			trayPostMessage.Call(window, wmClose, 0, 0)
		case <-desktopDone:
		}
	}()
	data.Size = uint32(unsafe.Sizeof(data))
	data.Window, data.ID, data.Flags, data.Callback, data.Icon = window, 1, 1|2|4|0x80, trayCallback, icon
	copy(data.Tip[:], syscall.StringToUTF16(appName+" "+appVersion+" - Open app / Exit"))
	if !addIcon() {
		return fmt.Errorf("could not add the inventory tray icon")
	}
	defer trayNotifyIcon.Call(2, uintptr(unsafe.Pointer(&data)))
	served := make(chan error, 1)
	go func() {
		served <- server.Serve(ln)
		trayPostMessage.Call(window, wmClose, 0, 0)
	}()
	var loopErr error
	var message trayMessage
	for {
		result, _, err := trayUser32.NewProc("GetMessageW").Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
		if int32(result) == -1 {
			loopErr = fmt.Errorf("tray message loop: %v", err)
			break
		}
		if result == 0 {
			break
		}
		trayUser32.NewProc("TranslateMessage").Call(uintptr(unsafe.Pointer(&message)))
		trayUser32.NewProc("DispatchMessageW").Call(uintptr(unsafe.Pointer(&message)))
	}
	// Stop accepting requests, then wait for active requests (and saves) to finish.
	if err := server.Shutdown(context.Background()); err != nil {
		return err
	}
	if err := <-served; err != nil && err != http.ErrServerClosed {
		return err
	}
	return loopErr
}

func showTrayMenu(window uintptr) {
	menu, _, _ := trayUser32.NewProc("CreatePopupMenu").Call()
	if menu == 0 {
		return
	}
	defer trayUser32.NewProc("DestroyMenu").Call(menu)
	appendItem := trayUser32.NewProc("AppendMenuW")
	appendItem.Call(menu, 0, trayOpen, uintptr(unsafe.Pointer(trayText("Open app"))))
	appendItem.Call(menu, 0x800, 0, 0) // separator
	appendItem.Call(menu, 0, trayExit, uintptr(unsafe.Pointer(trayText("Exit"))))
	var point trayPoint
	trayUser32.NewProc("GetCursorPos").Call(uintptr(unsafe.Pointer(&point)))
	trayUser32.NewProc("SetForegroundWindow").Call(window)
	trayUser32.NewProc("TrackPopupMenu").Call(menu, 0x0002, uintptr(point.X), uintptr(point.Y), 0, window, 0)
	trayPostMessage.Call(window, 0, 0, 0) // let clicking outside dismiss the menu
}

//go:embed assets/tray.png
var trayIconPNG []byte

func createTrayIcon(instance uintptr) (uintptr, error) {
	// Modern Windows accepts PNG icon resources, retaining the artwork's alpha.
	icon, _, err := trayUser32.NewProc("CreateIconFromResourceEx").Call(
		uintptr(unsafe.Pointer(&trayIconPNG[0])), uintptr(len(trayIconPNG)), 1, 0x00030000, 32, 32, 0)
	if icon == 0 {
		return 0, fmt.Errorf("create tray icon: %v", err)
	}
	return icon, nil
}
