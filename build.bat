@echo off
REM Builds the versioned Windows folder (needs Go from https://go.dev/dl/)
cd /d "%~dp0"
set /p APP_VERSION=<VERSION
set "APP_FOLDER=Inventory Management System %APP_VERSION%"
if not exist "dist\%APP_FOLDER%" mkdir "dist\%APP_FOLDER%"
go run github.com/akavel/rsrc@v0.10.2 -ico assets/app.ico -o rsrc_windows_amd64.syso
if errorlevel 1 (pause & exit /b 1)
go build -trimpath -ldflags "-s -w -H=windowsgui" -o "dist\%APP_FOLDER%\%APP_FOLDER%.exe" .
if errorlevel 1 (pause & exit /b 1)
echo Done: "dist\%APP_FOLDER%\%APP_FOLDER%.exe"
pause
