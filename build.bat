@echo off
REM Builds Inventory Management System.exe into the dist folder (needs Go from https://go.dev/dl/)
cd /d "%~dp0"
if not exist dist mkdir dist
go run github.com/akavel/rsrc@v0.10.2 -ico assets/app.ico -o rsrc_windows_amd64.syso
if errorlevel 1 (pause & exit /b 1)
go build -trimpath -ldflags "-s -w -H=windowsgui" -o "dist\Inventory Management System.exe" .
if errorlevel 1 (pause & exit /b 1)
echo Done: "dist\Inventory Management System.exe"
pause
