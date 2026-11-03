`app.png` is the user's custom mint and charcoal box artwork. It is the current
source for both the executable and tray icons, preserving its colors, aspect
ratio and transparency.

`app.ico` contains the custom design at 16, 24, 32, 48, 64, 128 and 256 pixels.
`tray.png` is the matching 32-pixel icon embedded in the Windows tray code.
`web/favicon.ico` is the matching browser tab icon, served locally with the app.
Regenerate the icon assets with `node tools/make-icon.cjs`
(Node 22+ and Chrome; override `CHROME_PATH` if needed).

The Windows build scripts embed this ICO using the pinned rsrc v0.10.2 tool.
The first build needs internet access to download that tool. Generated `.syso`
files are ignored by Git and only apply to Windows amd64 builds.
