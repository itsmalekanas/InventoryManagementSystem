#!/bin/sh
# Builds the portable app for Windows, macOS and Linux into ./dist
set -e
cd "$(dirname "$0")"
go test ./...
mkdir -p dist
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H=windowsgui" -o dist/InventoryApp.exe .
GOOS=darwin  GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o dist/InventoryApp-mac .
GOOS=linux   GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/InventoryApp-linux .
echo "Done. Files are in ./dist"
