# Resume here

Updated: 2026-11-19 (Asia/Baghdad).

## Latest completed checkpoint: v0.7

- Published v0.7 as latest at tag commit `6284e5c`. VERSION, README, and
  CHANGELOG match. Main workflow 44550493350 and tag workflow 44550493334
  passed. Verified published notes, both archive file lists, and SHA-256
  digests. Downloads: %TEMP%\inventory-release-v07-fc870d2d-5ce4-453c-866a-13b8ef120d9e.
- Reports has date ranges, Excel and CSV, recorded COGS and profit, and
  links to invoices affected by missing costs. Chrome verified totals and
  exports with 50,000 synthetic invoices. Desktop Excel opening is unverified.
- Invoice Settings offers Standard, Compact, Spacious, and Custom A4
  layouts. Verified draft restoration, preservation of legacy font IDs
  and invoice snapshots, and ZIP restore. Data formats are unchanged.
- Local shared checks and temporary Windows and Linux builds passed.
  Local Chrome and Firefox suites used synthetic data. Product label
  printing was removed before this release at the user's request.

## Latest completed checkpoint: v0.6.3

- Published v0.6.3 as latest at tag commit `197f6b6`. VERSION, README and
  CHANGELOG match. Verified the published notes against the changelog.
- Main workflow 44418546271 and tag workflow 44418546217 passed. Downloaded
  both published archives and verified their GitHub SHA-256 digests and file
  lists. Artifacts: %TEMP%\inventory-v063-release-a12b0dcd71d24052a36644412415b99d.
- The initial A4 text-style edit now preserves the existing header alignment.
  PDF and PNG omit unavailable logos and complete the export. Long text wraps
  within the invoice, and PDF table columns keep their widths across pages.
- Shared checks and local Chrome/Firefox suites passed with synthetic data.
  Firefox verified a 65-row PDF with every row, consistent columns, totals on
  the final page and no blank pages. No data or backup format changes.

## Latest completed checkpoint: v0.6.2

- Published latest v0.6.2, tag commit 8a2b242. VERSION and README match.
  CHANGELOG.md documents v0.6.2 plus v0.6.1/v0.6.0 history. Release workflow
  extracts the matching changelog section as its release body; exact published
  notes verified. Older releases retained. No unfinished release work.
- Main workflow 44085206069 passed. Tag workflow 44085206088 passed all shared,
  Windows Chrome/Firefox, Linux Firefox/desktop, four distro suites and build.
  Tag attempt 1 stalled in finance after Chrome/backup succeeded; cancelled and
  reran only affected jobs on a fresh runner. Attempt 2 passed with no code or
  test changes. Main and local finance checks also passed.
- Downloaded both published archives and verified GitHub SHA-256 digests and
  archive contents (Windows EXE only; Linux inventory/start.sh/README/icon only).
  API confirms v0.6.2 is latest, public, non-draft and non-prerelease.
  Verification: %TEMP%\inventory-v062-release-3437eaf0cb314863b05cfc7b4b34a3fd.
  Published Windows EXE tray smoke passed (menu, active-save drain, unchanged
  startup data and restart): %TEMP%\inventory-tray-4d875e1e33c34d739cc271bc10fc8618.
- Local release checks passed: checked Windows build (Go tests/vet, 15 JS tests,
  script syntax), Linux amd64 package, actionlint, changelog extraction and diff
  whitespace. Chrome: %TEMP%\inventory-regression-pwoK85; Firefox:
  %TEMP%\inventory-firefox-jwfWKf; Windows tray lifecycle:
  %TEMP%\inventory-tray-259ea74445c142718b467ef6587ca665. All synthetic data.
  All implementation notes below are included in the published v0.6.2 release;
  their earlier pending/no-push statements are historical checkpoints.

## v0.6.2 implementation details (supersedes earlier pending notes)

- Latest request: only IBM Plex Sans (English) and IBM Plex Sans Arabic (Arabic)
  for invoices for now. Both dropdowns retain one option and their preview.
  Regular/Medium/Bold remain. a4Layout renders both families for every saved
  font choice and default, preserving numeric/text-style settings. Backend still
  accepts previous font IDs so old JSON and ZIPs remain readable without forced
  rewrites. Removed every non-Plex font file/license/CSS face/manifest entry;
  four font files and two licenses remain, shared with the existing Plex UI.
  Updated English/Arabic hints, docs and font/export regression expectations.
- Latest verification passed: checked Windows build (Go tests/vet, JS syntax,
  15 JS tests), Linux amd64 package build, Chrome regression (inventory-
  regression-co4RYK), Firefox offline regression (inventory-firefox-DsDFnu).
  Both browsers tested PDF/PNG; Firefox checks exactly one option per language,
  all three font weights, English/Arabic/mobile, backup restore and restart.
  Artifacts are in %TEMP%; only synthetic data was used. No push/version bump.
- User approved smoother Settings preview, removing Google Sans, splitting the
  frontend, consistent amd64 build scripts and consolidating CI checks. Leave
  list pagination and database performance work for later. No release/version
  change requested; VERSION/latest stays v0.6.1. Base Git commit is ec69e79.
- Settings coalesces invoice DOM renders with frameUpdate (render-scheduler.js),
  uses the latest draft, renders initially immediately and ignores detached
  previews after navigation. Draft values, save status and validation remain
  synchronous. Firefox verifies 20 edits yield one render and immediate dirty
  status. Chrome assertions now wait for preview frames; sticky-preview checks
  use instant scrolling so they measure the target position rather than a
  smooth-scroll animation.
- Removed Google Sans dropdown entry, CSS face, 4,974,940-byte font, license and
  source-manifest entry. Existing googlesans identifiers remain accepted by the
  backend for data/ZIP compatibility and now render as IBM Plex Sans without rewriting
  stored records. Added legacy-font rendering and backup/restart tests including
  an invoice; existing backup compatibility coverage also exercises that ID.
- Split app.js into i18n.js, ui.js, products.js, pos.js, customers.js,
  invoices.js, invoice-export.js, reports.js, settings.js and backup.js. app.js
  retains router/Home/startup. Plain scripts load in index.html order with no
  bundler/runtime dependency. Tests read that actual order via frontend-source.
- tools/check.cjs runs Go tests/vet, JS syntax and all JS unit tests and is used
  by build.bat/build.sh and the CI shared-checks job. Windows builds now explicitly
  set windows/amd64/CGO_ENABLED=0. CI removes duplicate shared checks from its
  Linux/package jobs, retains native Windows backend and browser tests, Linux
  browser/desktop tests and four distro suites, and gates packaging on all jobs.
- Passed locally: complete build.bat and Git Bash build.sh (both with shared
  checks), 15 JS tests, backend/backup compatibility tests, Go vet, all browser
  script syntax, actionlint v1.7.12, shell syntax and git diff --check.
  Fresh Windows executable and static Linux amd64 archive built successfully.
  Chrome regression: inventory-regression-YQLYCk; Firefox: inventory-firefox-
  Qw2G4Z; backup: inventory-backup-e2e-sShj8n; finance: inventory-finance-qg0eNe
  (all under %TEMP%, all synthetic data/profiles/downloads). Firefox blocks
  external requests and checks English/Arabic/mobile, exports and ZIP restore.
  New Linux runtime/GUI/distro CI has not run: no push requested and this host
  has no WSL/Docker. Workflow validated locally; no claim of CI execution.

## Current platform policy: Intel/AMD 64-bit only

- User requested removing ARM64 from code/builds and GitHub downloads altogether.
  The Linux packager now has one fixed amd64 target and no architecture flag.
  Build.sh, test executable resolution, CI build/upload/release asset selection,
  and user/test/package docs now cover Windows and Linux Intel/AMD 64-bit only.
  Removed the unused macOS ARM build from build.sh as well. No version bump.
- Local Go tests/vet, 13 JS tests, shell syntax, Linux amd64 package build and
  actionlint passed. The generated ARM64 folder/archive under dist were removed
  after checking the folder contained only generated app files, not shop data.
- Pushed code cleanup as d443a71. Deleted both ARM64 release assets from v0.6.0
  and v0.6.1 and eight old mixed-architecture linux-portables CI bundles.
  Verified both releases now contain only Windows and Linux amd64 downloads;
  version tags and Git history remain. VERSION/latest remains v0.6.1.
- CI run 44076661320 passed Windows, Linux, all four distro suites and build.
  Windows passed on retry after an unexpected downloads.htm in the first run's
  temporary download folder; no test or application changes were needed.
  Historical architecture notes below
  describe old releases and must not be treated as current supported targets.

## Latest completed checkpoint: v0.6.1

- Published latest **v0.6.1**, tag commit `395e6ef`. Release workflow 44073131452
  passed Windows Chrome/Firefox, Ubuntu Firefox and GUI desktop launch, all four
  Linux distro backend/launcher suites, and final build.
- Downloaded all three published archives and verified GitHub SHA-256 digests
  and archive contents. Re-ran tray-smoke.ps1 against the published Windows EXE:
  passed hidden owner, menu, reuse, active-save drain, restart and web Exit.
  Verification: %TEMP%\inventory-v061-release-197bb07a8a2c4468a0ebd11571250d35;
  published tray test: %TEMP%\inventory-tray-afa60f0b44594cb7b7e9f1e24248d930.
- The Linux GUI check uses an Ubuntu virtual X11 desktop and isolated real Firefox
  profile. It does not cover every desktop environment/file-manager trust prompt;
  ARM64 is still cross-built without runtime testing. No unfinished code work.
- v0.6.0 was retained; older-release deletion was not requested for v0.6.1.
  All changes below are released. VERSION and README are v0.6.1.

## v0.6.1 change details

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
- No data/schema changes. Published after main and tag verification.
  Do not delete older releases unless newly requested.

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
