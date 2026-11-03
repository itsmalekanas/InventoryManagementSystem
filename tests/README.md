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
```

On Windows with Chrome installed, build the app and run:

```text
node tests/browser-regression.cjs
```

An alternate executable can be supplied as the first argument, or through
`INVENTORY_TEST_EXE`. `CHROME_PATH` can select a Chrome executable; the default
is `C:/Program Files/Google/Chrome/Application/chrome.exe`.

The browser test uses isolated app copies, temporary data and a temporary Chrome
profile. It tests English/Arabic number input, invalid form values, lost checkout
responses, original-invoice selection when newer sales exist, recovery after
reload, cancellation and late requests, independent app folders, repeated app
launches, and all four invoice date/time combinations in preview, print and PDF.
It stops only the test processes it started. Artifacts remain in the reported
temporary folder for inspection. It never opens or imports the shop's real data.

Old data compatibility means existing products, stock, prices, customers and
invoice snapshots continue to load. New optional settings get explicit defaults;
test legacy backups with the new fields absent as well as current backups. Keep
old field names and IDs stable when extracting frontend modules or optimizing
queries. Existing older executables do not understand new features or metadata;
use the updated executable when editing upgraded data.
