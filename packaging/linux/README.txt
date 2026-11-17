Inventory Management System - portable Linux edition

Targets: current Debian stable, Ubuntu stable, Fedora stable, and Arch Linux.
Choose linux-amd64 for Intel/AMD PCs, or linux-arm64 for ARM64 computers.

1. Extract the complete .tar.gz archive into a writable folder.
2. Run ./start.sh (or: sh start.sh). It prefers Firefox or Firefox ESR;
   otherwise it asks the desktop to open your default browser.
3. Use Exit on the Home page to stop the app. Closing a browser tab keeps
   the app running. Running start.sh again reopens the existing app.

No administrator access, package installation, Go, Node, FUSE or internet
connection is required to run the app. A modern browser is required separately.
The executable is static; fonts and web assets are bundled. Linux launchers
may require marking start.sh executable/trusted before a file-manager launch.
If opening the browser fails, open the local URL recorded in launcher.log.

Shop data stays in data/ beside inventory. Copy the entire folder to move
the app after exiting it. A USB drive must allow executing files and writing
data; copy to a local writable folder if the drive is mounted noexec.
For custom locations/options: ./start.sh -data /path/to/shop -port 8750
To run attached to a terminal: ./inventory (Ctrl+C stops it).

Windows and Linux use the same JSON and full backup ZIP format. For transfers,
export a full backup, then preview/import it in the destination app. Keep the
original backup. Do not have both operating systems modify the same data folder
at the same time. Changing OS may affect case-sensitive file names.

This edition uses the browser interface and the app's Exit button. A Linux tray
icon is not included. Desktop launch behavior depends on the desktop environment.
launcher.log contains startup information; it is not included in full backups.
