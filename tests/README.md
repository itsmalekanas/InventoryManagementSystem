# Regression checks

Run all shared backend tests, Go static checks, browser-script syntax checks and
JavaScript unit tests with `node tools/check.cjs` (Go and Node 22+ required).
Both build scripts use this same command. CI runs shared checks once, retains
Windows backend tests and both browsers, and retains the Linux desktop/distro
checks. Packaging waits for all checks to pass.

Browser code stays in plain scripts loaded in the order listed in
`web/index.html`: shared translations/UI helpers, screen files, and finally
`app.js` for routing/startup. Invoice exports live in `invoice-export.js`;
settings preview renders are combined per animation frame. No frontend build
step or external runtime requests are required.

## Firefox and portable Linux

Development-only Firefox tests use the locked Playwright dependency. These
packages are not needed by app users and are not bundled into the executable.

```sh
npm ci
npx playwright install firefox
node tests/browser-firefox.cjs /absolute/path/to/test-executable
```

On Linux CI, use `npx playwright install --with-deps firefox` to prepare the test
browser's system libraries. Playwright uses its own isolated Firefox build and
profile; it never opens the user's regular Firefox profile. Requests outside the
local app are blocked. Downloads, screenshots and synthetic shop data remain in
the reported temporary folder. Checks cover offline fonts, English/Arabic and
mobile layout, checkout, settings, PNG/PDF exports, ZIP preview/cancel/import,
web Exit and restart persistence. Run against a freshly built executable.

Build portable Linux archives with:

```sh
go run ./tools/build-linux
```

`tools/build-linux` forces `CGO_ENABLED=0`, rejects an ELF dynamic loader,
preserves executable modes in the archive, and uses an explicit file allowlist
to exclude any shop data. Its unit test verifies that exclusion.

On Linux, exercise the packaged launcher with paths containing spaces, Firefox
dispatch, instance reuse, portable data location, Exit and restart:

```sh
INVENTORY_LINUX_EXE="/absolute/path/to/package/inventory" go test -run '^TestLinuxPortableLauncher$' -v .
```

The launcher check stubs browser dispatch; actual Firefox rendering is tested
separately. CI also compiles the backend test runner statically and runs the full
suite and packaged-launcher check inside `debian:stable-slim`, `ubuntu:rolling`,
`fedora:latest` and `archlinux:latest`. Ubuntu's `rolling` tag tracks the latest
stable release, while `latest` tracks LTS. The supported architecture is Intel/AMD
64-bit. Linux execution checks run in CI because the current
Windows workspace has no WSL/Docker.

The Linux CI job also installs Openbox/xdotool/Xvfb and runs a real Firefox GUI
in an isolated virtual X11 display and D-Bus session:

```sh
xvfb-run -a dbus-run-session -- node tests/linux-desktop.cjs /absolute/path/to/package/inventory
```

This uses a synthetic desktop entry and temporary Firefox profile to verify
desktop dispatch, paths with spaces, browser-window minimize/reopen, portable
data and Exit. It does not verify every distribution's desktop environment or
file-manager trust prompts. Regular user browser profiles are never opened.

## Existing backend and Chrome checks

Run backend and compatibility tests with:

```text
go test ./...
go vet ./...
```

The backend tests cover original data defaults, backup round trips and rejection,
interrupted import recovery, stock/invoice consistency, durable checkout retries,
concurrent retries, cancellation, failed saves, deleted-invoice receipts, and
instance detection using both build and data directory.

Node 22+ runs the input validation tests without packages or installation:

```text
node --test tests/numbers.test.cjs
node --test tests/finance.test.cjs
node --test tests/color-picker.test.cjs
node --test tests/ui-contracts.test.cjs
```

On Windows with Chrome installed, build the app and run:

```text
node tests/browser-regression.cjs
node tests/browser-backup.cjs
node tests/browser-finance.cjs
powershell -NoProfile -File tests/tray-smoke.ps1
```

An alternate executable can be supplied as the first argument, or through
`INVENTORY_TEST_EXE`. `CHROME_PATH` can select a Chrome executable; the default
is `C:/Program Files/Google/Chrome/Application/chrome.exe`.

The browser test uses isolated app copies, temporary data and a temporary Chrome
profile. It tests English/Arabic number input, invalid form values, lost checkout
responses, original-invoice selection when newer sales exist, recovery after
reload, cancellation and late requests, independent app folders, repeated app
launches, and all four invoice date/time combinations in preview, print and PDF.
It also checks the product name/version and fixed language/theme controls on
desktop and mobile layouts in English and Arabic.
It stops only the test processes it started. Artifacts remain in the reported
temporary folder for inspection. It never opens or imports the shop's real data.

The backup browser test runs two isolated shops and checks ZIP download,
preview/cancel, complete Arabic data and image transfer, stale-tab protection,
restart persistence, damaged-file rejection, and undo using the recovery ZIP.
The PowerShell tray test checks the hidden console, name/version, menu, repeated
launches, and finishing an active save on Exit. Both use synthetic temporary
data. Tests find the versioned folder and executable in `dist` using `VERSION`.

The finance checks cover default-off cost tracking, unknown and zero costs,
historical cost snapshots, partial/full returns, refund dates, and custom sale
prices. Backend tests verify backup transfer, rejection of excess returns,
failed-save rollback, and concurrent retry safety. The finance browser test also
loses a saved return response and reloads before retrying, checks that customer
invoices hide costs, and captures English/Arabic desktop and mobile layouts.
It also checks cancelling web Exit, clean process termination, and saved data
after Exit. Lifecycle tests hold a save open while requesting Exit and verify
that acknowledgement waits for durable data. The tray test also exits a running
Windows tray process through the web API after restarting it.

Audit coverage includes matching English/Arabic translations and Home counts,
strict single-object JSON requests, stock-limit rollback on invoice deletion,
duplicate-click protection for product/customer saves, saving after image
uploads finish, and reopening invalid custom color fields. GitHub Actions runs
all JavaScript unit tests, browser-script syntax checks, Go tests and `go vet`
before building a release. Browser and tray integration tests run separately
on Windows using temporary shop data. The three browser suites now also run in
a Windows GitHub Actions job that must pass before the build/release job starts.
The interactive tray smoke check remains a separate Windows check.
`INVENTORY_TEST_EXE` can select a temporary
test executable so the source folder stays free of local builds.

Old data compatibility means existing products, stock, prices, customers and
invoice snapshots continue to load. New optional settings get explicit defaults;
test legacy backups with the new fields absent as well as current backups. Keep
old field names and IDs stable when extracting frontend modules or optimizing
queries. Existing older executables do not understand new features or metadata;
use the updated executable when editing upgraded data.
