#!/bin/sh
# Builds the portable app for Windows, macOS and Linux into ./dist
set -e
cd "$(dirname "$0")"
go test ./...
mkdir -p dist
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H=windowsgui" -o "dist/Inventory Management System.exe" .
GOOS=darwin  GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o dist/InventoryManagementSystem-mac .
GOOS=linux   GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/InventoryManagementSystem-linux .
echo "Done. Files are in ./dist"
