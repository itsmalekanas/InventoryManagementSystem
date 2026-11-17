#!/bin/sh
# Builds the portable app for Windows and Linux Intel/AMD PCs into ./dist
set -e
cd "$(dirname "$0")"
node tools/check.cjs
mkdir -p dist
version="$(tr -d '\r\n' < VERSION)"
folder="Inventory Management System $version"
mkdir -p "dist/$folder"
go run github.com/akavel/rsrc@v0.10.2 -ico assets/app.ico -o rsrc_windows_amd64.syso
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H=windowsgui" -o "dist/$folder/$folder.exe" .
go run ./tools/build-linux
echo "Done. Files are in ./dist"
