#!/bin/sh
# Run independently of the launching terminal. All paths are relative to this copy.
set -eu
app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
if [ ! -x "$app_dir/inventory" ]; then
  printf '%s\n' 'Cannot run inventory. Extract the archive with permissions preserved.' >&2
  exit 1
fi
log_file="$app_dir/launcher.log"
nohup "$app_dir/inventory" "$@" >> "$log_file" 2>&1 < /dev/null &
app_pid=$!
sleep 1
if ! kill -0 "$app_pid" 2>/dev/null; then
  if wait "$app_pid"; then exit 0; fi
  printf 'The app could not start. Check %s\n' "$log_file" >&2
  exit 1
fi
printf 'App started. Use Exit in the app to stop it. Log: %s\n' "$log_file"
