# Changelog

User-facing changes and maintenance updates are recorded here by release.
Dates use YYYY-MM-DD. The application version is separate from the database
and backup format versions. Earlier releases remain documented in Git history.

## [v0.7.3] - 2026-11-19

### Added

- Choose Default, Left, Center, or Right for each A4 invoice table column.
  The live preview, print layout, and PDF and PNG exports use the chosen
  alignment.

### Compatibility

- Existing invoice settings and backups retain their original alignment
  until a custom alignment is selected. Custom choices survive backup and
  restore.

## [v0.7.2] - 2026-11-19

### Added

- A4 invoice settings allow custom widths for item number, price, quantity,
  and total. Product names wrap within the remaining space. The preview,
  print layout, and PDF and PNG downloads use the chosen widths.
- Arial can be selected independently for English and Arabic invoices.
  It uses the installed font, with bundled IBM Plex as the fallback.

### Compatibility

- Existing layouts keep automatic column widths and their previous font
  behavior. New settings survive backup, restore, and restart.

## [v0.7.1] - 2026-11-19

### Changed

- Invoice layout controls stay visible whenever A4 is selected. Standard,
  Compact, and Spacious fill in the visible fields, and manual edits select
  Custom. The live preview updates as before.
- Spacing and alignment are grouped together. Typography uses a responsive
  size, weight, and color grid with samples for both bundled invoice fonts.

### Compatibility

- Existing databases, invoice snapshots, legacy font identifiers, and backup
  ZIPs retain their formats.

## [v0.7] - 2026-11-19

### Added

- Reports supports Today, This Month, Last Month, All Time, and inclusive
  custom date ranges. Sales and best sellers follow the selected period.
- Download reports as Excel workbooks or CSV. Exports include the selected
  dates, sales figures, best sellers, and current stock.
- Profit tracking shows recorded cost of goods sold, gross profit, and sales
  and refunds with missing costs. Reports links to the affected invoices.

### Changed

- Invoice Settings starts with paper size and A4 design. Standard, Compact,
  and Spacious presets update the live preview. Custom restores the prior
  layout draft before saving and exposes the detailed controls.
- Branding, invoice content, and invoice numbering have dedicated sections.

### Compatibility and upgrade

- Existing JSON databases, invoice snapshots, images, numbering, and backup
  ZIPs use the same formats. Exit the old app before copying its complete
  `data` folder or importing a full backup.

## [v0.6.3] - 2026-11-19

### Fixed

- The first A4 invoice text-style edit preserves the existing header alignment,
  so changing the store name's size, weight or color keeps it in place.
- PDF and PNG exports complete when the store logo is missing or unreadable.
  The export omits the unavailable logo.
- Long product names and unbroken codes wrap within the invoice. Multi-page
  PDFs use consistent table column widths.

### Compatibility and upgrade

- Existing databases and backup ZIPs work with this release. Exit the old app
  before copying its complete `data` folder or importing a full backup.

## [v0.6.2] - 2026-11-17

### Changed

- Invoices now use **IBM Plex Sans** for English and **IBM Plex Sans Arabic**
  for Arabic. Each language has one font option with a preview; Regular,
  Medium and Bold weights remain available.
- Rapid Settings edits now share one invoice preview render per browser frame.
  The preview uses the latest draft while save status and validation update
  immediately.
- Windows and Linux downloads now target Intel/AMD 64-bit computers only.

### Removed

- Other bundled invoice fonts and their dropdown options, reducing package size.
- ARM64 packaging, release downloads and old mixed-architecture CI artifacts.

### Maintenance

- Split the browser interface into focused files for translations, shared UI,
  individual screens and invoice exports, preserving the offline, no-build-step
  frontend.
- Standardized checked builds with `node tools/check.cjs`; Windows builds now
  explicitly target amd64 with CGO disabled.
- Consolidated shared CI checks while retaining native Windows tests, Chrome
  and Firefox coverage, Linux desktop checks and the four Linux distro suites.
- Added regression coverage for preview batching and retired-font backup/restart
  compatibility; stabilized preview assertions around animation frames and
  scrolling.
- Added this changelog and use each version's entry for GitHub release notes.

### Compatibility and upgrade

- Existing JSON databases, invoice records, counters, image references and backup
  ZIPs remain readable. Old font identifiers remain accepted; their text now
  renders with IBM Plex Sans / IBM Plex Sans Arabic. Older invoices may therefore
  look different when displayed or exported again.
- The app and bundled fonts continue to work offline.
- **Windows:** extract the Windows ZIP and run the EXE.
- **Linux:** extract the linux-amd64 archive and run `start.sh`. Firefox or
  Firefox ESR is preferred. Linux uses the web Exit button and has no tray icon.
- Exit the old app before copying its complete `data` folder into the new
  version's folder or importing a full backup into the new version.

## [v0.6.1] - 2026-11-17

### Changed

- Replaced native invoice text-color inputs with the shared in-app color picker.
- Made text-style rows more compact and moved smaller color-source labels beside
  group titles. Retained one reset button for all text styles.
- Default weight labels now show `Regular (Default)` or `Bold (Default)`, with
  Arabic equivalents matching the inherited style.
- Linux relaunch opens a Firefox window so a minimized app can be presented again.

### Fixed

- Color popovers fit smaller screens, scroll into view, close on Escape and close
  the previous text-color popover when another opens.
- Reset clears invalid or unfinished text-color drafts as well as overrides.

### Maintenance

- Added Linux desktop-launch smoke coverage using an isolated Firefox profile,
  virtual X11 desktop and synthetic shop data.

## [v0.6.0] - 2026-11-17

### Added

- Portable static Linux packages and a launcher for current Debian, Ubuntu,
  Fedora and Arch Linux, using the same offline browser interface as Windows.
- Firefox regression coverage on Windows and Linux, including offline use,
  English/Arabic layouts, exports, backups and restart persistence.
- Linux distro checks for the backend and portable launcher.

### Changed

- Main UI typography uses bundled IBM Plex Sans and IBM Plex Sans Arabic.
- Linux prefers Firefox / Firefox ESR and provides web Exit without a tray icon.

### Fixed

- Stale Settings drafts are rejected instead of overwriting newer changes from
  another browser tab.
- Settings saves are blocked while a logo upload is pending.
- Automatic daily-backup failures show a warning without discarding a saved change.
- Browser tests redirect downloads into temporary folders to keep test exports
  out of the user's Downloads folder.

[v0.6.3]: https://github.com/itsmalekanas/InventoryManagementSystem/compare/v0.6.2...v0.6.3
[v0.6.2]: https://github.com/itsmalekanas/InventoryManagementSystem/compare/v0.6.1...v0.6.2
[v0.6.1]: https://github.com/itsmalekanas/InventoryManagementSystem/compare/v0.6.0...v0.6.1
[v0.6.0]: https://github.com/itsmalekanas/InventoryManagementSystem/compare/v0.5.8...v0.6.0
