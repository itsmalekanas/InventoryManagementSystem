# Resume here

Updated: 2026-11-17 (Asia/Baghdad).

## Current release work: v0.6.1

- Final local checks passed: Go tests/vet, 13 JS tests, syntax/actionlint, Chrome
  and Firefox browser suites against the release-style v0.6.1 build. Windows
  tray-smoke.ps1 passed: hidden owner, menu, reuse, active-save drain on Exit,
  restart persistence and web Exit. Tray artifacts: %TEMP%\inventory-tray-
  9ebd7bbf60cc48f1b1c5f0b1dc338de9. Firefox: inventory-firefox-p6yDS2;
  Chrome: inventory-regression-kW3VeA.
- Added tests/linux-desktop.cjs and Ubuntu CI step with Xvfb/Openbox/D-Bus.
  Opens a synthetic desktop entry with real Firefox using a temporary profile,
  checks paths with spaces, minimize/reopen, data and Exit. Passed on commit
  e3c0d57 in CI run 44072576616; Linux artifacts /tmp/inventory-linux-desktop-Z9vbYf.
  The first run exposed that --new-tab stayed minimized; Linux Firefox/ESR now
  uses --new-window so relaunch presents a window and reuses the same app server.
  Does not cover every distro desktop/file-manager trust prompt or ARM64 GUI.

- Follow-up: default weight options now read Regular (Default) or Bold (Default),
  matching the inherited weight, with Arabic equivalents. Syntax and 13 JS tests
  passed after this label-only change.
- User requested the shared in-app color picker for all nine invoice text groups,
  with more compact rows and smaller color-source notes. Replaced native color
  inputs with InventoryColorPicker, preserving existing style source IDs/data
  bindings. Size/weight/color use equal columns; source notes now sit beside group
  titles. Shorter labels, controls and spacing; one Reset text styles retained.
- Text color panels are popovers that do not expand rows, stay within small-screen
  width, scroll into view and close previous text-style popovers. Escape closes
  them. Reset clears unfinished/invalid hex drafts as well as overrides. Inactive
  receipt-mode A4 color drafts follow existing numeric-validation behavior.
- Checked syntax, all 13 JS tests and Chrome regression suite. Expanded Firefox
  suite passed: all nine shared pickers/no native inputs, invalid hex blocking,
  reset recovery, save/reload, mobile popup bounds, RTL UI, PNG/PDF and ZIP restore.
  Chrome screenshot: %TEMP%\inventory-regression-JSXDKQ. Latest Firefox artifacts:
  %TEMP%\inventory-firefox-u2FUUR. Desktop/mobile screenshots reviewed.
- No data/schema changes. User authorized publishing all current work as latest
  v0.6.1. VERSION/README updated. Push main and verify the new Linux GUI check
  before tagging. Do not delete older releases unless newly requested.

## Latest completed checkpoint: v0.6.0

- Published latest release **v0.6.0**, tag commit `77772de` (implementation
  `2d783b1`). Tag workflow `44060236075` succeeded: Windows/Ubuntu Firefox,
  Windows Chrome suites, all four Linux distro backend/launcher suites, and build.
- All three release assets downloaded and verified against GitHub SHA-256 digests:
  Windows ZIP, Linux amd64 TAR.GZ, Linux arm64 TAR.GZ. Archive contents checked.
  Verification files: %TEMP%\inventory-v060-release-870317350ece4caf86dc591324acde92.
- Per user request, deleted **22 older GitHub releases and their attached assets**,
  including the old `latest` release. API confirmed only v0.6.0 remains, with all
  three assets. Git tags and commit history intentionally retained; v0.5.8 and
  v0.6.0 tags were verified after cleanup.
- All earlier local UI, download-test isolation and portable Linux work below is
  included in this release. VERSION and README are v0.6.0. No unfinished code work.
- Remaining manual checks: Linux desktop/file-manager launch, Windows tray smoke.
  ARM64 is cross-built but not runtime-tested. Older notes below retain historical
  checkpoint details; this latest checkpoint takes precedence.

## Project and published state

- Offline Go inventory/sales app with embedded HTML/CSS/JavaScript; Arabic/English,
  IQD integer amounts, JSON persistence, images, Windows tray, verified ZIP backups.
- User authorized publishing all current work as **v0.6.0** latest on 2026-11-17,
  then deleting older GitHub releases and their downloads. Preserve Git tags/history.
  Publish and verify all new assets before removing older releases.
- v0.5.8 published as latest at `c3e54ba` with Windows ZIP; GitHub checks passed.
- v0.5.7 published as latest at `c65581c` with Windows ZIP; GitHub checks passed.
- v0.5.6 published as latest at `98e7e18` with Windows ZIP; GitHub checks passed.
- v0.5.5 published as latest at `aa232f5` with Windows ZIP; GitHub checks passed.
- v0.5.4 was pushed at `fe00994`; GitHub confirmed the latest release has its
  Windows ZIP. Windows browser checks, Go tests/vet, and JS checks passed on GitHub.
- `VERSION` and README now use v0.6.0. This release adds portable Linux packages,
  Firefox checks, IBM Plex UI fonts and test download isolation, on top of the
  existing invoice styles, exports and Settings improvements.
  Previous text styles, PNG/PDF exports and reliability fixes remain included. Tag push starts the GitHub
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

- User authorized work on portable Linux targeting current Debian stable, latest
  Ubuntu stable, Fedora stable and Arch, with Firefox as primary browser.
  User subsequently authorized release/push as v0.6.0.
- Implemented tools/build-linux (Go, standard library only): static CGO-disabled
  amd64/arm64 executables, ELF dynamic-loader rejection, portable folder and TAR.GZ
  with executable permissions. Archive allowlist excludes shop data and logs even
  when present in output folders; synthetic unit test covers this. Existing dist
  shop data untouched. Packages built locally under dist/InventoryManagementSystem-
  v0.5.8-linux-{amd64,arm64}.tar.gz. Build.sh includes these archives.
- packaging/linux/start.sh uses nohup and logs startup beside the app, keeping it
  running after terminal closure. Reopening uses existing instance detection;
  web Exit stops it. No Linux tray. Linux browser opener tries Firefox, Firefox
  ESR, xdg-open, then gio; Windows/macOS dispatch unchanged. Added Linux-only
  fallback/packaged launcher tests (spaces, data location, reuse, Exit, restart).
- Added dev-only locked Playwright dependency and browser-firefox.cjs. Downloaded
  its isolated Firefox browser (does not change normal Firefox profiles). Passed
  locally on Windows: offline-only requests, IBM Plex UI/fonts, English/Arabic at
  desktop/mobile widths, real checkout, settings persistence, PNG/PDF downloads,
  ZIP preview/cancel/full restore, web Exit and restart. Latest artifacts:
  %TEMP%\inventory-firefox-VLIZJv. Go tests/vet, 13 JS tests, shell syntax checks,
  static Linux test-runner cross-compilation, package builds and actionlint passed.
- CI now gates release on Firefox checks (Windows/Ubuntu) and Linux backend/
  portable-launcher suite in Debian stable-slim, Ubuntu rolling (latest stable,
  rather than LTS latest tag), Fedora latest and Arch latest containers. Publishes
  Linux archives alongside Windows on future authorized tags. README documents
  portable use and development dependencies.
- Linux CI verified on main commit 2d783b1: Windows and Ubuntu Firefox suites,
  Debian stable-slim, Ubuntu rolling, Fedora latest and Arch latest backend/
  portable-launcher suites, and final build all passed. Workflow run 44058685645.
  Real Linux desktop launch still needs a manual smoke check; ARM64 is built,
  not runtime-tested. Local Windows host has no WSL/Docker.
- User superseded Inter with IBM Plex Sans for English and IBM Plex Sans Arabic
  for Arabic in the main UI. Added AppPlexLatin/AppPlexArabic faces using existing
  bundled files. Latin unicode ranges route Arabic glyphs to the Arabic family;
  Regular/Medium/Bold supported offline. Same stack in LTR/RTL. Invoice font
  selections untouched; no new assets downloaded. All 13 JS tests and diff check
  passed. User subsequently requested testing: Go tests/vet, fresh build and
  browser suite passed. Browser verified AppPlexLatin/AppPlexArabic at 400/500/700,
  LTR/RTL switches, dark/light layout stability, 390px width and PNG/PDF exports.
  English/light and Arabic/dark home screenshots visually reviewed at
  %TEMP%\inventory-regression-sIJwvv. Test downloads remain isolated in temp.
  Local CSS/test changes; VERSION remains v0.5.8. Included in the authorized v0.6.0 release.
- User reported unrequested invoice PDFs appearing in Downloads. Root cause:
  browser-regression.cjs directly exported a synthetic layout-test invoice before
  setting Browser.setDownloadBehavior; Chrome's isolated profile still defaults
  to the user's Downloads folder. App code only exports PDF on button click.
  Fixed locally by setting a temporary download directory immediately after CDP
  connection, before opening the app. Added checks for no automatic downloads
  during navigation/settings and that the first explicit PDF lands in temp.
  Browser suite passed at %TEMP%\inventory-regression-TD0s1d; existing Downloads
  PDF metadata unchanged after the run. Did not delete the user's existing file.
  Tests-only fix included in v0.6.0. User Downloads stay untouched by test runs.
- User approved clarity tweaks: default text sizes now show effective pixel
  values, default weight names show Regular/Bold, and color swatches show hex
  values plus Follows accent / Default black / Custom color. Values refresh
  with presets, accent changes and reset. Base font-size input moved from Layout
  into Typography. No persistence/schema changes.
- Added saved/unsaved status beside Settings Save across tabs. Compares form
  values, logo and normalized optional layout; catches invalid drafts and avoids
  false changes from omitted boolean fields. Edits, reverts, tab switching and
  save/reload checked in browser. Toolbar stacks below 768px for more room.
  All 13 JS tests, syntax, diff check and browser suite passed; screenshot reviewed
  at %TEMP%\inventory-regression-vmQGtm. Included in v0.5.8; release/push authorized.
- After v0.5.7, user requested one Reset for text styles instead of nine.
  Removed individual buttons; added Reset text styles below the groups, clearing
  all textStyles overrides together. Fonts, spacing and layout remain intact.
  English/Arabic labels and helper text updated. Syntax, 13 JS tests and browser
  suite passed, including single-reset control, restored values and preserved
  font/layout. Artifacts: %TEMP%\inventory-regression-L4g1HM.
  Included in v0.5.8; release/push authorized.
- User requested font dropdowns to save space while retaining previews. Replaced
  both grids with Bootstrap selects, each with a live selected-font sample below.
  All font choices preserved; changing/resetting fonts updates the sample and
  invoice preview. Fonts now load on selection rather than for every font card.
  Syntax, 13 JS tests and browser suite passed (all new choices/weights, sample
  family updates, save/reload, mobile layout, external HTTPS blocked, PNG/PDF).
  Dropdown screenshot reviewed: %TEMP%\inventory-regression-425hxy.
  Included in v0.5.7; user authorized push and latest release.
- After v0.5.6, added six invoice font families: English Manrope, IBM Plex Sans,
  Noto Sans; Arabic IBM Plex Sans Arabic, Noto Sans Arabic, Noto Naskh Arabic.
  Dropdowns retain all previous choices/defaults with live font samples.
  Bundled unmodified TTFs and OFL licenses from the existing pinned Google Fonts
  commit; sources.json records hashes. Added ~4.6MB of raw font files.
  All six support real Regular/Medium/Bold (Arabic Plex has three static files).
- Font verification: Go tests/vet, all 13 JS tests (hashes/licenses included),
  backup/restart with new font choices, and expanded browser suite passed.
  Browser loaded all six at 400/500/700 with external HTTPS blocked, checked local
  font resource origins, saved/reloaded selections, mobile width, and Arabic RTL
  PNG/PDF downloads with Noto Sans + Noto Naskh Arabic. Cards and PNG reviewed.
  Artifacts: %TEMP%\inventory-regression-yy0Av1. Included in v0.5.7.
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
