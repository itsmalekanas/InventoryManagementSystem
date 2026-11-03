@echo off
REM Builds InventoryApp.exe into the dist folder (needs Go from https://go.dev/dl/)
cd /d "%~dp0"
if not exist dist mkdir dist
go build -trimpath -ldflags "-s -w -H=windowsgui" -o dist\InventoryApp.exe .
if errorlevel 1 (pause & exit /b 1)
echo Done: dist\InventoryApp.exe
pause
