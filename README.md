# Inventory Management System v0.4.8

**v0.4.8 is an early release under active development.** The application version
is stored in `VERSION` and shown on Home, in the browser title, and in the tray
tooltip. It is independent of the database and backup format version numbers.

A small, portable inventory and sales app for a shop. It runs on your own
computer with nothing to install, keeps all data in its own folder, works fully
offline, and supports Arabic and English (right-to-left layout included).
Prices are in Iraqi dinars (IQD).

The Home page has a language button and a sun/moon button together on the right;
their positions stay fixed when switching between Arabic and English. Use the
sun/moon button to switch light/dark mode. The theme is saved with your settings
and included in full backups. Invoice previews, printing, and downloaded PDFs
keep a light background in either mode.

## What it does

The home page is a grid with the main parts of the system:

| Tile | What you do there |
| --- | --- |
| **New sale** | Point of sale screen like Odoo POS, with the cart on the left. Tap products to add them to the cart. Type a customer name or phone number and choose from the dropdown to fill their details, or enter a new customer. Press *Complete sale*: stock goes down and the invoice opens ready to print or download. |
| **Inventory** | Your products as picture cards. Add a product with just a name, a price, pictures and the number of pieces in stock. |
| **Customers** | Customers are saved automatically with each sale (matched by phone number). You can also add or edit them and see how much each one bought. |
| **Invoices** | Every sale, newest first, with search. Open one to print it or use **Download PDF** to save it directly without the print dialog. PDFs use the invoice number as their filename (for example `INV-HS-2026-00001.pdf`). Printing also uses the invoice number as the document title, which browsers normally suggest as the PDF filename. You can also delete an invoice and choose whether the pieces go back to stock. |
| **Reports** | Sales today, this month and in total, the value of your stock, low stock items and best sellers. |
| **Settings** | Store name, logo (upload, size and position), invoice title, header and footer text, accent color for the invoice text, fill color for the even table rows (A4), a "PAID" stamp under the total, separate **Show date** and **Show time** switches, paper size (A4 or 80 mm receipt printer), language and low stock warning level. A live preview shows the invoice as you change things. |
| **Backup & transfer** | Export all saved app data to one verified ZIP. On another computer, choose the ZIP, review the contents, and confirm import. A complete recovery backup is saved before replacing existing data. |

## Optional costs, profit and returns

Settings also includes **App colors** with presets, a custom inline color
picker, live preview and a reset button. One accent themes headers, primary
buttons, product prices, links, selection highlights and form
controls. Text accents use a darker or lighter shade of the selected color for
readability in either theme. Status colors (such as red errors and stock
warnings) keep their meaning. Subpage titles are larger, bold and centered, with the store name in bold below
them. App colors are independent of invoice colors and included in backups.
Home tile icons keep their distinct category colors independently of the app accent.
The inline pickers offer a color area, hue/saturation/brightness sliders and hex
entry, and are also used for invoice colors. They work entirely offline.

Cost tracking is off by default. Turn on **Enable cost prices and profit reports**
in Settings to add an optional cost per piece in product forms and show gross
profit in Reports. Leave a cost blank if unknown; zero means a known zero cost.
Selling prices, checkout and stock work normally with tracking off. Turning it
off hides the controls and reports while preserving saved costs and history.

New sales snapshot known costs only while tracking is enabled. Editing costs
later never changes old sales; older invoices without costs remain unknown.
Profit excludes those items and reports the excluded net sales. Gross profit is
before shop expenses, and product costs never appear on customer invoices.

Open an invoice and choose **Return items** for a partial or full return. Enter
the quantities and choose whether the pieces go back into stock. The refund uses
the original unit prices, including custom prices. Arrange payment with the
customer separately; this records the refund but does not transfer money.
Returns are saved on the original invoice, which cannot then be deleted.
Reports subtract refunds and their original profit on the return date; customer
totals and best sellers also account for returns. The original printed invoice
stays intact. Full ZIP backups include costs and the return history.

## How to use it (Windows)

1. Download `InventoryManagementSystem-v0.4.8-windows.zip` from the
   [early release page](../../releases/tag/v0.4.8) and unzip it anywhere, for example
   on the desktop or a USB stick.
2. Double click `Inventory Management System v0.4.8.exe`. The app opens in your browser and a mint-colored box
   inventory icon appears in the Windows notification area near the clock.
   There is no console window. Windows may place the icon under the **^** arrow.
3. Running `Inventory Management System v0.4.8.exe` again while it is already open just opens the
   browser page again, provided it is the same build using the same data folder.
   A copy in another folder uses its own data and an available local port. If an
   older or different build is running for the same data, exit it before opening
   the updated copy. An old app that cannot identify its data/build also needs
   to be closed rather than being silently reused.
4. Right click the tray icon and choose **Open app** to reopen the browser, or
   **Exit** to stop the app. Closing the browser leaves the app running in the
   tray. Exit waits for active requests to finish before stopping.

You can also choose **Exit** at the top right of Home. Confirm to finish active
saves and transfers, stop the server and tray process, and show **App closed**.
You can then close the browser tab. Unsaved edits and the cart are not saved;
finish your sale first. Other open tabs for this app will disconnect. Start the
executable again to reopen it.

Windows may show a "Windows protected your PC" message the first time because
the program is not signed. Click **More info** and then **Run anyway**.

## Where the data is saved

Everything is saved next to the program, in a folder called `data`:

```
Inventory Management System v0.4.8/
  Inventory Management System v0.4.8.exe
  data/
    db.json        all products, customers, invoices and settings (UTF-8, Arabic safe)
    images/        product pictures and the store logo
    backups/       an automatic daily copy of db.json (the last 30 days the app was used)
```

To back up the app or move it to another computer, copy the whole
versioned application folder. To restore an older day, close the app and copy a file
from `backups` over `data/db.json`.

### Updating from an older version

Earlier versions used `InventoryApp.exe`, `Inventory System.exe` or the unversioned
`Inventory Management System.exe`. The new executable is
`Inventory Management System v0.4.8.exe`; keep it beside the existing `data` folder. The app name
does not change your store name, invoice numbers, data format, or backup support.

The original JSON database and images are supported. Close the old app first
(close its console window, or use **Exit** in its tray menu), and make a backup
of its whole folder. Replace only the executable in that folder to keep using
the same data, and remove the old executable to avoid launching the wrong version.
Alternatively, copy the **entire `data` folder**, including
`db.json`, `images`, and `backups`, next to the new executable before starting
it. Copying only `db.json` will not transfer the pictures or logo. Copying a
data folder replaces that destination's data; it does not merge two shops.

### Transfer everything with one file

1. On the original computer, open **Backup & transfer** (from Home or Settings)
   and click **Export everything**. Wait for verification and keep the downloaded
   `InventoryBackup-….zip` file. Check that the browser download has finished.
2. Copy that ZIP to the other computer, start a fresh copy of the app, and open
   **Backup & transfer**.
3. Choose the ZIP. The app checks its format, checksums, database records,
   invoice totals/counters, and all image references before showing a preview.
4. Review the store name and record counts, then choose **Replace data with this
   backup** and confirm. Keep the app running until **Import complete** appears.

The ZIP contains the saved database, product pictures, store logo, settings,
historical invoices, invoice counters (including deleted/skipped numbers), and
daily database backups. It contains saved data only; save edits and finish any
sale you want to transfer before exporting. The destination's installation path
is retained, and imports replace its data rather than merging two databases.
No internet, installer, or extra runtime is needed.

Before replacing existing data, a fully verified ZIP of the destination is saved
beside its data folder in **`data-recovery/`** (or `<custom-data-name>-recovery/`).
The success screen shows its exact path. To undo an import, import that recovery
ZIP through the same screen. These local safety archives are kept separately,
so every export does not recursively include all previous full exports. They
are not included in transfer ZIPs; copy `data-recovery` separately if you also
want to move that computer's restore history. Daily database backups inside
`data/backups` are included.

Import validates and stages files before replacing anything, and refuses to
commit if destination data changed after the preview. It uses a recovery journal
for interrupted directory replacement and blocks outdated browser tabs from
saving into restored data. Refresh any other open tabs after importing or
restarting the app. Only one process may write to a data folder at a time.
An import interrupted before replacement keeps the original data; if the new
directory was already installed, startup verifies it and completes cleanup.
If recovery cannot verify a copy, it preserves the copies and reports an error.

Supported limits: 2 GiB per ZIP, 4 GiB expanded, 10,000 data files, 256 MiB for
the database, and 15 MiB per image. ZIPs from unsupported future formats, missing
images, damaged files, unknown database fields, or inconsistent invoice totals
are rejected. SHA-256 checksums detect corruption; they are not authentication
or encryption. Keep backups somewhere safe, and retain the source copy until
you have checked the destination. Normal hardware/filesystem failures can never
be ruled out completely.

## Calculations

All amounts are whole dinars stored as whole numbers, so there is never any
rounding. The line total is *price × quantity*, and the invoice total is the
sum of the line totals. Prices and totals are always worked out by the
program from the saved product prices, never typed by hand, and a sale is
refused if there are not enough pieces in stock. A finished invoice keeps its
own copy of the product names and prices, so changing a price later does not
change old invoices.

Price, stock, quantity, and numbering inputs accept English, Arabic-Indic and
Persian digits, with correctly grouped thousands separators. Invalid text,
negative values and decimals are rejected rather than being turned into another
number. For example `25,000` and `٢٥٬٠٠٠` mean 25,000; `-5` and `12.5` are invalid.

Checkout uses a unique request ID stored with its invoice and stock update.
Retries return the original invoice, including after restart, and never create
another invoice for that request. A record remains if the invoice is deleted.
If the browser loses the response, **Resolve previous checkout** offers a retry
or **Cancel attempt and review cart**. Cancellation opens the saved invoice if
it already exists; otherwise it records a cancellation so a delayed request
cannot create a sale later. The tab keeps pending checkout details across a
reload. Reopening only looks up their status; it never automatically submits
a new sale. Following a server restart or data import, an unresolved attempt
must be cancelled/reviewed before creating a new checkout.

**Show date** and **Show time** affect the invoice preview, printing and direct
PDF download independently. Hiding either does not remove the saved transaction
timestamp or change invoice history and reports. Older data defaults to showing
both. Checkout receipts and the visibility settings are included in full backups.

Invoices are numbered `INV-HS-<year>-<number>`, for example
`INV-HS-2026-00001`, then `INV-HS-2026-00002`. The number has five digits,
starts again at 00001 every new year, and is never given out twice, even if
an invoice is deleted.

To jump ahead, change **Next invoice number** in Settings and save. For example,
setting it to `500` makes the next invoice `INV-HS-2026-00500`, followed by
`00501`. On **New sale**, the invoice number above the cart has a **Change**
button for choosing a number for that sale; subsequent invoices continue from
it. **Use automatic number** cancels a sale's override. Overrides are only
reserved when the sale succeeds. Numbers can only move forward, from 1 through
999,999,999; skipped and deleted numbers cannot be reused. Changes apply to the
current year, leave existing invoices unchanged, and survive restarting the app.

## Building from source

Published downloads are built by GitHub Actions from version tags. Local builds
are optional, for development and Windows integration checks.

You need [Go](https://go.dev/dl/) 1.24 or newer.

- Windows: double click `build.bat`. The program is written to `dist\Inventory Management System v0.4.8\Inventory Management System v0.4.8.exe`.
- macOS / Linux: run `./build.sh`. Programs for all three systems are written to `dist/`.
- To run it while developing: `go run .` (data is then saved in `./data`).
- Tests: `go test ./...`
- Number-entry tests (Node 22+): `node --test tests/numbers.test.cjs`.
- Windows browser regression tests: `node tests/browser-regression.cjs`
  after building; see [tests/README.md](tests/README.md).

Options (PowerShell): `& ".\Inventory Management System v0.4.8.exe" -port 8750 -data D:\ShopData -no-browser`.
Use `-version` to print `Inventory Management System v0.4.8` and exit without opening any data.
For foreground development or automation, add `-no-tray`. Linux/macOS builds
currently run in the foreground with the same browser interface; press Ctrl+C
to stop. The Windows tray implementation uses native APIs and no CGO, so
cross-compilation stays available without Linux desktop dependencies.

Pushes to `main` build and test the app. Version tags such as `v0.4.8` publish a
separate release with the Windows ZIP, marked as latest (see `.github/workflows/build.yml`).
Update `VERSION` before tagging; the tag must match that file. Older versioned
releases remain available. The newest published release is also available from
the repository's latest-release link.

### Development and release workflow

1. Edit the source and run the relevant checks in [tests/README.md](tests/README.md).
2. Review, commit and push changes to `main`. GitHub Actions tests the source
   and builds a Windows artifact without changing published releases.
3. When ready to release, update `VERSION` and the version references in this
   README, commit and push, then create and push a matching tag (for example
   `v0.4.8`). The tag workflow publishes its own release and Windows ZIP.

Keep source, tests, build scripts and icon assets in Git. Generated executables,
`dist/` and `.syso` files are ignored. The icon assets are committed so release
builds do not need Chrome or access to the original design file.

Use a separate extracted release folder for everyday shop use. A local `dist/`
folder can contain real `data/` and backups if its executable has been run;
preserve those when cleaning generated build files. Shop data and backups
should never be committed to Git.

The app is one Go program with the web pages built in (`web/`). It uses
[Bootstrap](https://getbootstrap.com/) and
[Bootstrap Icons](https://icons.getbootstrap.com/), both included in
`web/vendor` so nothing is loaded from the internet.

Direct PDF export uses [html2pdf.js](https://github.com/eKoopmans/html2pdf.js)
0.14.0, also bundled in `web/vendor` with its license. Export renders the invoice
as images in the PDF to preserve Arabic text and the invoice design; text in
downloaded PDFs is not selectable. Long invoices are split into pages with
repeated invoice and table headers. Downloads follow your browser's download
location and save-prompt preferences.

---

## بالعربية

تطبيق بسيط وخفيف لإدارة المخزون والمبيعات، يعمل على الحاسوب مباشرة بدون تثبيت
وبدون إنترنت، ويدعم اللغة العربية بالكامل. العملة هي الدينار العراقي (د.ع).

**طريقة الاستخدام:** فك ضغط الملف `InventoryManagementSystem-v0.4.8-windows.zip` في أي مكان (مثلاً
على فلاش USB) ثم شغّل `Inventory Management System v0.4.8.exe`. سيفتح التطبيق في المتصفح وتظهر أيقونة
بنفسجية قرب ساعة ويندوز بدون نافذة سوداء. اضغط عليها بزر الفأرة الأيمن واختر
`Open app` لفتح التطبيق أو `Exit` لإيقافه. إغلاق المتصفح لا يوقف التطبيق.
قد تجد الأيقونة ضمن السهم **^**. لتغيير اللغة اضغط زر
«العربية» في الصفحة الرئيسية أو من الإعدادات.

**حفظ البيانات:** كل البيانات تُحفظ في مجلد `data` بجانب البرنامج (ملف
`db.json` بترميز UTF-8 ومجلد الصور). يُحفظ تلقائياً نسخة احتياطية يومية لآخر
30 يوماً في مجلد `backups`. للنسخ الاحتياطي أو النقل إلى حاسوب آخر انسخ مجلد
التطبيق كاملاً.

**الحسابات:** كل المبالغ بالدينار وبدون كسور. مجموع السطر = السعر × الكمية،
ومجموع الفاتورة = مجموع الأسطر. لا يمكن بيع كمية أكبر من الموجود في المخزون.

**نقل البيانات:** افتح «النسخ الاحتياطي والنقل» ثم «تصدير كل البيانات».
انقل ملف ZIP إلى الحاسوب الآخر واختره في الشاشة نفسها، وراجع المعاينة ثم أكّد
الاستبدال. يشمل الملف البيانات المحفوظة والصور والشعار وعدادات الفواتير والنسخ
اليومية. يُحفظ أرشيف استرداد للبيانات السابقة في مجلد `data-recovery` بجانب
مجلد البيانات؛ يمكن استيراده للتراجع. انتظر رسالة اكتمال الاستيراد وأعد تحميل
أي علامات تبويب أخرى مفتوحة. الاستيراد يستبدل البيانات ولا يدمج متجرين.
