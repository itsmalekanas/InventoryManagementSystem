`box-seam.svg` is the original Bootstrap Icons box-seam design:
https://icons.getbootstrap.com/icons/box-seam/

Copyright The Bootstrap Authors. MIT license; see
`../web/vendor/bootstrap-icons/LICENSE`.

`app.ico` contains transparent black versions of that design at 16, 24, 32,
48, 64, 128 and 256 pixels. Regenerate with `node tools/make-icon.cjs`
(Node 22+ and Chrome; override `CHROME_PATH` if needed).

The Windows build scripts embed this ICO using the pinned rsrc v0.10.2 tool.
The first build needs internet access to download that tool. Generated `.syso`
files are ignored by Git and only apply to Windows amd64 builds.
