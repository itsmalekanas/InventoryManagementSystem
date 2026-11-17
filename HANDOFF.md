# Resume here

Updated: 2026-11-17 (Asia/Baghdad).

## Project and published state

- Offline Go inventory/sales app with embedded HTML/CSS/JavaScript; Arabic/English,
  IQD integer amounts, JSON persistence, images, Windows tray, verified ZIP backups.
- User authorized publishing all current work as **v0.5.6** latest on 2026-11-17.
- v0.5.5 published as latest at `aa232f5` with Windows ZIP; GitHub checks passed.
- v0.5.4 was pushed at `fe00994`; GitHub confirmed the latest release has its
  Windows ZIP. Windows browser checks, Go tests/vet, and JS checks passed on GitHub.
- `VERSION` and README now use v0.5.6. This release adds independent invoice
  text styles and direct offline PNG download beside PDF, building on the
  existing reliability fixes and visible Settings sections. Tag push starts the GitHub
  workflow, which publishes the Windows ZIP as latest after checks pass.
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
  smoke test remains separate. Check the v0.5.4 tag workflow for GitHub validation.

## Verification completed locally

- `go test ./...` and `go vet ./...` passed.
- All 11 JavaScript unit tests passed; frontend syntax checks passed.
- All three browser suites passed with the reliability build: checkout/UI,
  backup transfer/recovery, finance/returns.
- `git diff --check` passed before this checkpoint's documentation was added.
- Tests used synthetic data and temporary app copies; no shop data was changed.

## User preferences and pending decisions

- Added Download PNG beside Download PDF on the invoice page (English/Arabic).
  Uses bundled html2pdf canvas rendering offline, waits for fonts/images/styles,
  and downloads one white-background PNG named after the invoice code. A4 and
  receipt supported. Long images reduce scale to stay within 16384px and a
  32-million-pixel budget. PDF/PNG share a busy guard and restore buttons after
  errors; temporary render elements are cleaned up.
  Syntax, 13 JS tests and expanded browser suite passed: four date/time variants
  in actual PNG/PDF downloads, PNG signatures/dimensions, receipt, 300-row image,
  failed-render recovery and cleanup. Exported PNG visually reviewed.
  Latest artifacts: %TEMP%\inventory-regression-fwtPkf. Included in v0.5.6.
- User approved independent invoice text styles, replacing the single weight
  selector. Implemented nine visible groups: store, title, detail labels, values,
  table headings, rows, totals/paid, header, footer. Each has size (8–48px),
  Default/Regular/Medium/Bold weight, color, and independent Reset. Shared fonts
  and sticky preview retained. A4-only, like the existing typography controls.
- Optional a4Layout.textStyles overrides are validated on the server and before
  rendering; missing overrides retain legacy layout/emphasis/color behavior.
  Existing layout fields remain supported. Store/title numeric controls moved
  into their style groups; old stored values still supply defaults.
- Verification: all Go tests (including original-data compatibility, old ZIP
  import and new styles ZIP/restart round-trip), vet, 13 JS tests, syntax and
  browser suite passed. Browser checks cover every group's size/weight/color,
  independent reset, validation, save/reload, narrow screens and print/PDF.
  Latest browser artifacts: %TEMP%\inventory-regression-BoA74T.
  Included in v0.5.6; user authorized release/push.
- After v0.5.5, user requested bold invoice labels with normal values. Invoice
  number, date/time, customer, phone and address now use separate label/value
  elements. A4 labels follow the existing headings/regular weight setting;
  values stay regular. Shared markup applies to preview, print and PDF.
  Syntax, all 11 JS tests, build and checkout/UI browser suite passed, including
  computed weights for all labels/values in both modes. Included in v0.5.6;
  independent text styles now supersede the single weight selector.
- User approved moving Settings Save beside the tabs in a sticky toolbar.
  Implemented a Bootstrap brand Save outside the tablist, linked to the existing
  form. Settings header scrolls away so the toolbar stays at the viewport top;
  small screens put Save on a second row. Shared save/upload guards unchanged.
  Syntax, 11 JS tests, fresh build and checkout/UI browser suite passed, including
  sticky Save visibility. Included in v0.5.5.
- User requested Bootstrap buttons after reporting uneven Settings tab corners.
  Settings tabs now use btn btn-outline-primary and Bootstrap's active state.
  Removed custom tab borders/padding/background/focus rules and the global 8px
  button-radius override. Brand colors and shared keyboard focus retained.
  Syntax, 11 JS tests and diff check passed. Included in v0.5.5.
- After v0.5.4, user requested compact font controls: one grid per language,
  all fonts together without the Previously available fonts subgroup, retaining
  every font sample. Implemented locally in web/app.js and web/style.css.
  Syntax, all 11 JS tests, fresh Go build and browser regression passed with
  synthetic data, including narrow-screen overflow checks. Included in v0.5.5.
- Maintain backward compatibility with old data and backups.
- No keyboard-shortcut additions requested.
- No database-transfer/performance redesign requested.
- User rejected collapsible Invoice settings and approved visible stacked sections.
  Implemented Branding, Invoice content, Typography, and Layout with dividers,
  retaining the sticky preview and shared Save. Legacy fonts and numeric layout
  controls are always expanded. A4-only controls still follow the paper selection.
  Changes are included in v0.5.4 in web/app.js, web/style.css, and the browser suite.
  JavaScript syntax, all 11 unit tests, fresh Go build, and checkout/UI browser
  regression passed using synthetic temporary data. Desktop screenshot reviewed;
  narrow-screen overflow and sticky preview checks passed. No persistence changes.
- Existing invoice features include spacing/text-size presets, Advanced numeric
  controls, bundled offline English/Arabic fonts including Google Sans, visual
  font cards, Settings tabs, shared sticky-toolbar Save, and generic preview details.
- Release verification: final Go tests and vet passed before v0.5.5 publication.
  Check GitHub Actions and the latest-release page for publication completion.

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
