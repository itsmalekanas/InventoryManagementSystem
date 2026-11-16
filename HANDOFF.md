# Resume here

Updated: 2026-11-17 (Asia/Baghdad).

## Project and published state

- Offline Go inventory/sales app with embedded HTML/CSS/JavaScript; Arabic/English,
  IQD integer amounts, JSON persistence, images, Windows tray, verified ZIP backups.
- Published latest release: **v0.5.3**, commit `71ba1db`.
- `VERSION` remains v0.5.3. The reliability work below is not released or pushed.
- The Qt experiment was completely removed at the user's request. No desktop
  migration is active. Continue work on the existing web app.

## Latest completed work: reliability fixes

- Settings payloads include a hash token; current browser clients submit the
  expected token, and outdated settings drafts receive HTTP 409 instead of
  silently overwriting changes from another tab. Drafts remain available for
  copying. Legacy API calls without tokens remain supported; tokens are runtime
  metadata, not a database/backup schema change.
- Settings Save waits for logo uploads. Upload/delete controls and form controls
  are disabled during relevant operations; duplicate submissions are guarded.
- Browser reload/close protection covers dirty visible forms, carts, pending
  checkout, settings operations, and transfers. Settings navigation also detects
  edits that fail numeric validation. Browsers govern close-prompt display.
- Daily backups use synced temporary files and replacement, retry invalid backup
  files, clean temporary files, and report failures through a persistent UI
  warning. Successful database saves are retained even if their backup fails.
  A successful retry clears the runtime warning.
- Added `reliability_test.go` and browser assertions for blocked settings saves
  during logo uploads and reload protection.
- GitHub Actions now has a Windows job for checkout, backup and finance browser
  tests; the existing build/release job depends on it. The interactive tray
  smoke test remains separate. This workflow change still needs validation on
  GitHub after an authorized push.

## Verification completed locally

- `go test ./...` and `go vet ./...` passed.
- All 11 JavaScript unit tests passed; frontend syntax checks passed.
- All three browser suites passed with the reliability build: checkout/UI,
  backup transfer/recovery, finance/returns.
- `git diff --check` passed before this checkpoint's documentation was added.
- Tests used synthetic data and temporary app copies; no shop data was changed.

## User preferences and pending decisions

- Maintain backward compatibility with old data and backups.
- No keyboard-shortcut additions requested.
- No database-transfer/performance redesign requested.
- User asked what would improve the Invoice tab. Proposed collapsible sections:
  Branding, Content, Typography, Advanced; retain the sticky live preview and all
  controls. **This layout change has not been approved or implemented.**
- Existing invoice features include spacing/text-size presets, Advanced numeric
  controls, bundled offline English/Arabic fonts including Google Sans, visual
  font cards, Settings tabs, shared header Save, and generic preview details.
- Next step: user can review/publish reliability fixes or decide on the Invoice
  tab proposal. Do not infer a request to release from resuming this checkpoint.

## Development environment

PowerShell sessions may have stale PATH. Installed executables:

- Git: `C:\Program Files\Git\cmd\git.exe`
- Go: `C:\Program Files\Go\bin\go.exe`
- Node: `C:\Program Files\nodejs\node.exe`
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`

Use absolute paths or refresh the session PATH from the Machine/User values.
Go cache access, GUI execution and network operations may require tool approval.
Git author identity was missing globally; earlier commits used command-local
`-c user.name=Malek -c user.email=itsmalekanas@gmail.com`, matching existing history.

Browser scripts accept a test executable argument or `INVENTORY_TEST_EXE`.
Last temporary build: `%TEMP%\inventory-setup-verification\Inventory Reliability.exe`.
Build a fresh temporary executable if needed. Preserve any real data under dist.
