# Regression checks

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
data. The tray test uses the default executable in `dist`.

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

Old data compatibility means existing products, stock, prices, customers and
invoice snapshots continue to load. New optional settings get explicit defaults;
test legacy backups with the new fields absent as well as current backups. Keep
old field names and IDs stable when extracting frontend modules or optimizing
queries. Existing older executables do not understand new features or metadata;
use the updated executable when editing upgraded data.
