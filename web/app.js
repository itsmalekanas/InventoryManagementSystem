'use strict';

/* =========================================================
   Inventory Management System – browser interface, no build step.
   All amounts are whole Iraqi dinars (integers).
   ========================================================= */

const I18N = {
  en: {
    customHeaderColor: 'Custom color',
    inventoryProductCount: 'Products', inventoryPieceCount: 'Pieces in stock', inventoryShowing: 'Showing {n} of {total} products · {pieces} pieces in stock',
    headerPresets: 'Header color presets', presetMint: 'Mint', presetPurple: 'Purple', presetSlate: 'Slate', presetBlue: 'Blue', presetGreen: 'Green', presetCharcoal: 'Charcoal',
    topbarTheme: 'Page header', topbarColor: 'Header background color', topbarHint: 'Applies to subpages. Text adjusts automatically for readability. Invoice colors are separate.', resetTopbar: 'Reset header color',
    sortInventory: 'Sort inventory', sortNameAsc: 'Name: A–Z', sortNameDesc: 'Name: Z–A',
    sortPriceAsc: 'Price: low to high', sortPriceDesc: 'Price: high to low', sortStockAsc: 'Stock: low to high', sortStockDesc: 'Stock: high to low', sortNewest: 'Date added: new to old', sortOldest: 'Date added: old to new',
    exitLabel: 'Exit',
    exitApp: 'Exit app', exitConfirm: 'Exit the software? Active saves will finish before it closes. Unsaved edits and the current cart will be discarded. Other open tabs for this app will disconnect.',
    appClosing: 'Closing app…', appClosingHelp: 'Waiting for active saves and transfers to finish. Please keep this page open.',
    appClosed: 'App closed', appClosedHelp: 'Saved data is safe. You can close this browser tab. To use the app again, start Inventory Management System.exe.',
    exitBusy: 'Finish the current transfer or resolve the pending checkout before exiting.',
    exitUncertain: 'The connection was lost while exiting. Check whether the tray icon has disappeared. Start the executable again when you want to reopen the app.',
    'err.exiting': 'The app is closing. Please wait for active saves to finish.',
    trackProfit: 'Enable cost prices and profit reports',
    trackProfitHint: 'Optional. Sales work normally when off. Blank costs are unknown and excluded from profit; 0 means a known zero cost. Costs are saved with future sales only.',
    costPrice: 'Cost per piece (optional)', costHint: 'Leave blank if unknown. This never changes the selling price or appears on customer invoices.',
    grossProfit: 'Gross profit', profitHint: 'Sales minus recorded product costs, before shop expenses. Only items with a saved cost are included; returns reverse their original profit.',
    excludedRevenue: 'Net sales excluded because cost is unknown: {v}',
    returns: 'Returns', returnItems: 'Return items', returnQty: 'Return now', remaining: 'Available to return',
    restockReturn: 'Put returned items back in stock', noRestock: 'Stock was not changed', refundTotal: 'Refund total', recordReturn: 'Record return',
    returnHint: 'Refunds use the original sale price. Record the refund here after arranging payment with the customer.',
    returnSaved: 'Return recorded', returned: 'Returned', netSales: 'Net sales',
    netSalesHint: 'Sales minus refunds. Refunds are counted on the date the return is recorded.',
    noReturns: 'No returns recorded.', returnRetry: 'Retry the same return', returnPending: 'The result is uncertain. Retry this same return to check it safely, or reopen the invoice to check its return history.',
    'err.badCost': 'Enter a whole cost between 0 and 1,000,000,000, or leave it blank.',
    'err.badReturn': 'Choose valid quantities. You cannot return more pieces than were sold or already returned.',
    'err.returnChanged': 'This return attempt has different details. Reopen the invoice and review its return history.',
    'err.returnDelete': 'An invoice with returns cannot be deleted. Its original sale and return history must stay together.',
    'err.returnProductGone': 'A returned product no longer exists. Restore it first, or record this return without restocking.',
    editSalePrice: 'Edit price', regularPrice: 'Use regular price', customPrice: 'Custom unit price', salePriceHint: 'Applies to every piece on this line, for this sale only. Enter 0 for a gift.',
    appName: 'Inventory Management System', cur: 'IQD', loading: 'Loading…',
    home: 'Home', pos: 'New sale', posSub: 'Sell products from the inventory',
    products: 'Inventory', productsSub: '{n} products · {low} low on stock',
    customers: 'Customers', customersSub: '{n} customers',
    invoices: 'Invoices', invoicesSub: '{n} invoices',
    reports: 'Reports', reportsSub: 'Today: {v}',
    settings: 'Settings', settingsSub: 'Store, logo and invoice design',
    switchLang: 'العربية',
    darkMode: 'Switch to dark mode', lightMode: 'Switch to light mode', toggleTheme: 'Toggle dark mode',
    search: 'Search…', addProduct: 'Add product', editProduct: 'Edit product',
    name: 'Name', price: 'Price', pieces: 'Pieces in stock', pictures: 'Pictures',
    addPictures: 'Add pictures', mainPicture: 'Make main picture', removePicture: 'Remove picture',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close', back: 'Back',
    noProducts: 'No products yet. Add your first product.', noResults: 'Nothing found.',
    inStock: '{n} in stock', outOfStock: 'Out of stock', lowStock: 'Low stock',
    confirmDeleteProduct: 'Delete the product “{name}”? Old invoices keep their copy of it.',
    saved: 'Saved', deleted: 'Deleted',
    cart: 'Cart', emptyCart: 'Tap a product to add it to the cart.', clearCart: 'Clear cart',
    customer: 'Customer', customerName: 'Customer name', customerSearch: 'Type a customer name or phone…', newCustomerHint: 'No matching customers. You can enter a new customer.', phone: 'Phone number', address: 'Address',
    total: 'Total', items: 'Items', pcs: 'pcs', completeSale: 'Complete sale', saleDone: 'Sale saved',
    onlyLeft: 'Only {n} left in stock',
    checkoutPending: 'Resolve previous checkout', checkoutPendingHelp: 'A checkout is waiting for confirmation. Retrying uses the same request and cannot create a second invoice. Cancel and review will open an existing invoice if the sale was already saved.',
    checkoutRetry: 'Retry previous checkout', checkoutReview: 'Cancel attempt and review cart', checkoutCancelled: 'Checkout cancelled. Review the cart before completing a new sale.',
    checkoutChanged: 'The app restarted or its data changed. If no saved invoice was found, cancel this attempt and review the cart before creating a new sale.', checkoutWait: 'Please wait while checkout is being resolved.',
    'err.saleRequest': 'This checkout has no valid request ID. Reload the page and try again.',
    'err.saleRequestChanged': 'This checkout ID belongs to different sale details. Check invoices before starting another sale.',
    'err.saleCancelled': 'This checkout attempt was cancelled.', 'err.saleDeleted': 'This checkout was already saved, but its invoice was deleted. It will not be recreated.',
    'err.checkoutStorage': 'The browser could not keep the checkout recovery record. Enable browser storage before completing the sale.',
    addCustomer: 'Add customer', editCustomer: 'Edit customer', noCustomers: 'No customers yet. They are added automatically with each sale.',
    invoicesCount: 'Invoices', totalSpent: 'Total bought', viewInvoices: 'Invoices',
    confirmDeleteCustomer: 'Delete the customer “{name}”? Their invoices are kept.',
    invoice: 'Invoice', invoiceNo: 'Invoice no.', date: 'Date', product: 'Product', qty: 'Qty',
    nextInvoiceNumber: 'Next invoice number', changeNumber: 'Change', automaticNumber: 'Use automatic number',
    numberingHint: 'Choose the number for this year. Future invoices continue from it. Numbers can only move forward.',
    numberingMinimum: 'Next available: {code}',
    noInvoices: 'No invoices yet.', print: 'Print', downloadPdf: 'Download PDF', creatingPdf: 'Creating PDF…', pdfError: 'Could not create the PDF. Please try again or use Print.', shown: '{n} invoices shown', sum: 'Sum',
    filterCustomer: 'Invoices of {name}', showAll: 'Show all',
    deleteInvoice: 'Delete invoice', deleteInvoiceQ: 'Delete invoice {n}?',
    deleteRestock: 'Delete and return the pieces to stock', deleteOnly: 'Delete only (keep stock as it is)',
    invoiceGone: 'This invoice does not exist.',
    today: 'Today', thisMonth: 'This month', allTime: 'All time', salesCount: '{n} invoices',
    stockValue: 'Inventory value', stockPieces: '{n} pieces in stock', lowStockList: 'Low stock',
    topProducts: 'Best selling products', soldQty: 'Sold', revenue: 'Revenue', nothing: 'Nothing to show yet.',
    general: 'General', language: 'Language', storeName: 'Store name', showStoreName: 'Show store name on the invoice',
    logo: 'Logo', uploadLogo: 'Upload logo', removeLogo: 'Remove logo', logoSize: 'Logo size',
    logoAlign: 'Logo position', alignStart: 'Start', alignCenter: 'Center', alignEnd: 'End',
    invoiceDesign: 'Invoice', invoiceTitle: 'Invoice title', invoiceTitlePh: 'Invoice',
    header: 'Header text', headerPh: 'Address, phone numbers…', footer: 'Footer text', footerPh: 'Thank you for your visit!',
    paid: 'PAID', showPaid: 'Show “PAID” under the total',
    time: 'Time', showDate: 'Show date on invoice', showTime: 'Show time on invoice',
    accentColor: 'Accent color (text)', rowColor: 'Even rows fill color (A4)',
    paper: 'Paper size', paperA4: 'A4 page', paperReceipt: 'Receipt printer (80 mm)',
    lowStockAt: 'Warn about low stock at (pieces)', preview: 'Preview', dataFolder: 'Data folder',
    dataNote: 'All data and pictures are saved in this folder. To back up or move the app, copy the whole app folder.',
    sampleCustomer: 'Sample customer', sampleProduct: 'Sample product',
    unsaved: 'You have unsaved changes. Leave without saving?',
    backup: 'Backup & transfer', backupSub: 'Export everything or restore a backup',
    exportBackup: 'Export everything', importBackup: 'Choose backup ZIP',
    backupDescription: 'One ZIP contains all saved products, customers, invoices, settings, images, logo, invoice counters and daily backups. Unsaved edits and the current cart are not included.',
    importDescription: 'Choose a backup exported by this app. Review it before replacing this computer’s data. Import replaces data; it does not merge shops.',
    backupPreparing: 'Creating and verifying the backup…', backupDownloading: 'Backup verified. Download started. Keep the ZIP until you have imported it on the other computer.',
    importChecking: 'Uploading and checking every file…', importPreview: 'Verified backup',
    backupCounts: '{products} products · {customers} customers · {invoices} invoices · {images} images · {backups} daily backup files',
    importReplace: 'Replace data with this backup', importConfirm: 'Replace all data on this computer with the verified backup? A full recovery backup of the current data will be saved first.',
    importWorking: 'Saving recovery backup and restoring data. Keep the app running…',
    importComplete: 'Import complete. Your previous data is saved in this recovery backup:',
    backupWait: 'Please wait for the transfer to finish.', backupDate: 'Exported',
    'err.backup': 'The backup could not be processed.',
    'err.backupBusy': 'Another backup operation is running. Please wait and try again.',
    'err.importExpired': 'This import preview expired. Choose the backup file again.',
    'err.importChanged': 'Data changed after the preview. Choose the backup again and review it before importing.',
    'err.dataReplaced': 'The data changed or the app restarted. Reload this page before saving.',
    'err.importRecovery': 'Import recovery needs attention. Exit and restart the app. Your recovery copies have been preserved.',
    'err.notFound': 'It was not found. It may have been deleted.',
    'err.badRequest': 'The request was not valid.',
    'err.nameRequired': 'Please enter a name.',
    'err.badPrice': 'Please enter a valid price (whole dinars).',
    'err.badStock': 'Please enter a valid number of pieces.',
    'err.badQty': 'Please enter a valid quantity.',
    'err.phoneTaken': 'Another customer already has this phone number.',
    'err.customerRequired': 'Please enter the customer name.',
    'err.cartEmpty': 'The cart is empty.',
    'err.productGone': 'A product in the cart no longer exists.',
    'err.notEnoughStock': 'There are not enough pieces in stock. The cart was updated, please check it.',
    'err.tooLarge': 'The total is too large.',
    'err.badImage': 'This file is not a supported picture (JPG, PNG, WEBP or GIF).',
    'err.save': 'The data could not be saved to the app folder.',
    'err.server': 'Something went wrong.',
    'err.offline': 'The app is not running. Start it again from the app folder.',
    'err.invoiceNumber': 'Enter a whole invoice number from 1 to 999,999,999.',
    'err.invoiceNumberUsed': 'This number is below the next available number. Choose a higher number or use automatic numbering.',
    'err.invoiceYearChanged': 'The year has changed. Refresh the page and choose the invoice number again.',
  },
  ar: {
    customHeaderColor: 'لون مخصص',
    inventoryProductCount: 'عدد المنتجات', inventoryPieceCount: 'القطع في المخزون', inventoryShowing: 'عرض {n} من أصل {total} منتج · {pieces} قطعة في المخزون',
    headerPresets: 'ألوان جاهزة لشريط العنوان', presetMint: 'نعناعي', presetPurple: 'بنفسجي', presetSlate: 'رمادي مزرق', presetBlue: 'أزرق', presetGreen: 'أخضر', presetCharcoal: 'فحمي',
    topbarTheme: 'شريط عنوان الصفحات', topbarColor: 'لون خلفية شريط العنوان', topbarHint: 'يُطبق على الصفحات الداخلية. يتكيف لون النص تلقائياً للوضوح. ألوان الفاتورة مستقلة.', resetTopbar: 'استعادة اللون الافتراضي',
    sortInventory: 'ترتيب المخزون', sortNameAsc: 'الاسم: تصاعدياً', sortNameDesc: 'الاسم: تنازلياً',
    sortPriceAsc: 'السعر: من الأقل إلى الأعلى', sortPriceDesc: 'السعر: من الأعلى إلى الأقل', sortStockAsc: 'المخزون: من الأقل إلى الأعلى', sortStockDesc: 'المخزون: من الأعلى إلى الأقل', sortNewest: 'تاريخ الإضافة: من الأحدث إلى الأقدم', sortOldest: 'تاريخ الإضافة: من الأقدم إلى الأحدث',
    exitLabel: 'خروج',
    exitApp: 'إغلاق البرنامج', exitConfirm: 'هل تريد إغلاق البرنامج؟ ستكتمل عمليات الحفظ الجارية أولاً. ستُفقد التعديلات غير المحفوظة والسلة الحالية. ستنقطع بقية الصفحات المفتوحة لهذا البرنامج.',
    appClosing: 'جارٍ إغلاق البرنامج…', appClosingHelp: 'بانتظار اكتمال عمليات الحفظ والنقل الجارية. يرجى إبقاء هذه الصفحة مفتوحة.',
    appClosed: 'تم إغلاق البرنامج', appClosedHelp: 'البيانات المحفوظة بأمان. يمكنك إغلاق هذه الصفحة. لاستخدام البرنامج مجدداً شغّل Inventory Management System.exe.',
    exitBusy: 'أكمل عملية النقل الحالية أو تأكيد البيع المعلّق قبل الإغلاق.',
    exitUncertain: 'انقطع الاتصال أثناء الإغلاق. تحقق من اختفاء أيقونة البرنامج بجانب الساعة. شغّل البرنامج مجدداً عندما تريد فتحه.',
    'err.exiting': 'البرنامج قيد الإغلاق. يرجى انتظار اكتمال الحفظ.',
    trackProfit: 'تفعيل سعر التكلفة وتقارير الربح',
    trackProfitHint: 'اختياري. البيع يعمل كالمعتاد عند إيقافه. التكلفة الفارغة مجهولة وتُستثنى من الربح؛ الصفر تكلفة معروفة. تُحفظ التكلفة مع المبيعات الجديدة فقط.',
    costPrice: 'تكلفة القطعة (اختياري)', costHint: 'اتركها فارغة إن لم تعرفها. لا تغيّر سعر البيع ولا تظهر على فاتورة الزبون.',
    grossProfit: 'إجمالي الربح', profitHint: 'المبيعات ناقص تكلفة البضاعة المسجلة، قبل مصاريف المحل. يشمل الأصناف ذات التكلفة المحفوظة فقط؛ المرتجعات تعكس ربحها الأصلي.',
    excludedRevenue: 'صافي المبيعات المستثناة لعدم معرفة التكلفة: {v}',
    returns: 'المرتجعات', returnItems: 'إرجاع أصناف', returnQty: 'الكمية المرتجعة الآن', remaining: 'المتاح للإرجاع',
    restockReturn: 'إعادة القطع المرتجعة إلى المخزون', noRestock: 'لم يتغير المخزون', refundTotal: 'المبلغ المسترد', recordReturn: 'تسجيل الإرجاع',
    returnHint: 'يُحسب المبلغ بسعر البيع الأصلي. سجّل الإرجاع هنا بعد ترتيب إعادة المبلغ للزبون.',
    returnSaved: 'تم تسجيل الإرجاع', returned: 'مرتجع', netSales: 'صافي المبيعات',
    netSalesHint: 'المبيعات ناقص المبالغ المستردة. يُحتسب الإرجاع بتاريخ تسجيله.',
    noReturns: 'لا توجد مرتجعات مسجلة.', returnRetry: 'إعادة محاولة الإرجاع نفسه', returnPending: 'لم تتأكد النتيجة. أعد المحاولة نفسها بأمان أو افتح الفاتورة مجدداً للتحقق من سجل المرتجعات.',
    'err.badCost': 'أدخل تكلفة صحيحة من 0 إلى 1,000,000,000 أو اتركها فارغة.',
    'err.badReturn': 'اختر كميات صحيحة. لا يمكن إرجاع قطع أكثر من الكمية المباعة أو إرجاع القطع نفسها مرتين.',
    'err.returnChanged': 'تفاصيل محاولة الإرجاع تغيّرت. افتح الفاتورة مجدداً وراجع سجل المرتجعات.',
    'err.returnDelete': 'لا يمكن حذف فاتورة لها مرتجعات للحفاظ على سجل البيع والإرجاع.',
    'err.returnProductGone': 'أحد الأصناف المرتجعة لم يعد موجوداً. استعده أولاً أو سجّل الإرجاع دون إعادته للمخزون.',
    editSalePrice: 'تعديل السعر', regularPrice: 'استخدام السعر الأصلي', customPrice: 'سعر الوحدة المخصص', salePriceHint: 'ينطبق على كل قطعة في هذا السطر ولهذه البيعة فقط. أدخل 0 للهدية.',
    appName: 'Inventory Management System', cur: 'د.ع', loading: 'جارٍ التحميل…',
    home: 'الرئيسية', pos: 'بيع جديد', posSub: 'بيع منتجات من المخزون',
    products: 'المخزون', productsSub: '{n} منتج · {low} قليل المخزون',
    customers: 'الزبائن', customersSub: '{n} زبون',
    invoices: 'الفواتير', invoicesSub: '{n} فاتورة',
    reports: 'التقارير', reportsSub: 'اليوم: {v}',
    settings: 'الإعدادات', settingsSub: 'المتجر والشعار وتصميم الفاتورة',
    switchLang: 'English',
    darkMode: 'التبديل إلى الوضع الداكن', lightMode: 'التبديل إلى الوضع الفاتح', toggleTheme: 'تبديل الوضع الداكن',
    search: 'بحث…', addProduct: 'إضافة منتج', editProduct: 'تعديل المنتج',
    name: 'الاسم', price: 'السعر', pieces: 'عدد القطع في المخزون', pictures: 'الصور',
    addPictures: 'إضافة صور', mainPicture: 'اجعلها الصورة الرئيسية', removePicture: 'حذف الصورة',
    save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', close: 'إغلاق', back: 'رجوع',
    noProducts: 'لا توجد منتجات بعد. أضف أول منتج.', noResults: 'لا توجد نتائج.',
    inStock: '{n} في المخزون', outOfStock: 'نفد المخزون', lowStock: 'مخزون قليل',
    confirmDeleteProduct: 'حذف المنتج «{name}»؟ الفواتير السابقة تحتفظ بنسختها منه.',
    saved: 'تم الحفظ', deleted: 'تم الحذف',
    cart: 'السلة', emptyCart: 'اضغط على منتج لإضافته إلى السلة.', clearCart: 'إفراغ السلة',
    customer: 'الزبون', customerName: 'اسم الزبون', customerSearch: 'اكتب اسم الزبون أو رقم الهاتف…', newCustomerHint: 'لا يوجد زبون مطابق. يمكنك إدخال زبون جديد.', phone: 'رقم الهاتف', address: 'العنوان',
    total: 'المجموع', items: 'المواد', pcs: 'قطعة', completeSale: 'إتمام البيع', saleDone: 'تم حفظ البيع',
    onlyLeft: 'المتبقي في المخزون {n} فقط',
    checkoutPending: 'تأكيد عملية البيع السابقة', checkoutPendingHelp: 'هناك عملية بيع تنتظر التأكيد. إعادة المحاولة تستخدم الطلب نفسه ولا تنشئ فاتورة ثانية. الإلغاء والمراجعة يفتحان الفاتورة الموجودة إذا حُفظ البيع مسبقاً.',
    checkoutRetry: 'إعادة محاولة البيع السابق', checkoutReview: 'إلغاء المحاولة ومراجعة السلة', checkoutCancelled: 'أُلغيت المحاولة. راجع السلة قبل إتمام بيع جديد.',
    checkoutChanged: 'أُعيد تشغيل التطبيق أو تغيّرت بياناته. إذا لم تُعثر على فاتورة محفوظة، ألغِ المحاولة وراجع السلة قبل إنشاء بيع جديد.', checkoutWait: 'يرجى الانتظار حتى تأكيد حالة البيع.',
    'err.saleRequest': 'لا يوجد معرّف صالح لهذا البيع. حدّث الصفحة وحاول مجدداً.',
    'err.saleRequestChanged': 'معرّف المحاولة مرتبط بتفاصيل بيع مختلفة. راجع الفواتير قبل بدء بيع آخر.',
    'err.saleCancelled': 'أُلغيت محاولة البيع هذه.', 'err.saleDeleted': 'حُفظ هذا البيع مسبقاً ثم حُذفت فاتورته. لن تُنشأ الفاتورة مجدداً.',
    'err.checkoutStorage': 'تعذّر حفظ سجل استرداد البيع في المتصفح. فعّل تخزين المتصفح قبل إتمام البيع.',
    addCustomer: 'إضافة زبون', editCustomer: 'تعديل الزبون', noCustomers: 'لا يوجد زبائن بعد. يُضافون تلقائياً مع كل عملية بيع.',
    invoicesCount: 'الفواتير', totalSpent: 'مجموع المشتريات', viewInvoices: 'الفواتير',
    confirmDeleteCustomer: 'حذف الزبون «{name}»؟ ستبقى فواتيره محفوظة.',
    invoice: 'فاتورة', invoiceNo: 'رقم الفاتورة', date: 'التاريخ', product: 'المنتج', qty: 'الكمية',
    nextInvoiceNumber: 'رقم الفاتورة التالية', changeNumber: 'تغيير', automaticNumber: 'استخدام الترقيم التلقائي',
    numberingHint: 'اختر الرقم لهذه السنة. ستتابع الفواتير التالية من هذا الرقم. يمكن زيادة الأرقام فقط.',
    numberingMinimum: 'الرقم التالي المتاح: {code}',
    noInvoices: 'لا توجد فواتير بعد.', print: 'طباعة', downloadPdf: 'تنزيل PDF', creatingPdf: 'جارٍ إنشاء PDF…', pdfError: 'تعذّر إنشاء PDF. حاول مجدداً أو استخدم الطباعة.', shown: 'عدد الفواتير المعروضة: {n}', sum: 'المجموع',
    filterCustomer: 'فواتير {name}', showAll: 'عرض الكل',
    deleteInvoice: 'حذف الفاتورة', deleteInvoiceQ: 'حذف الفاتورة رقم {n}؟',
    deleteRestock: 'حذف وإرجاع القطع إلى المخزون', deleteOnly: 'حذف فقط (بدون تغيير المخزون)',
    invoiceGone: 'هذه الفاتورة غير موجودة.',
    today: 'اليوم', thisMonth: 'هذا الشهر', allTime: 'الكل', salesCount: '{n} فاتورة',
    stockValue: 'قيمة المخزون', stockPieces: '{n} قطعة في المخزون', lowStockList: 'مخزون قليل',
    topProducts: 'المنتجات الأكثر مبيعاً', soldQty: 'المباع', revenue: 'المبيعات', nothing: 'لا يوجد شيء لعرضه بعد.',
    general: 'عام', language: 'اللغة', storeName: 'اسم المتجر', showStoreName: 'إظهار اسم المتجر في الفاتورة',
    logo: 'الشعار', uploadLogo: 'رفع الشعار', removeLogo: 'إزالة الشعار', logoSize: 'حجم الشعار',
    logoAlign: 'موضع الشعار', alignStart: 'البداية', alignCenter: 'الوسط', alignEnd: 'النهاية',
    invoiceDesign: 'الفاتورة', invoiceTitle: 'عنوان الفاتورة', invoiceTitlePh: 'فاتورة',
    header: 'نص الترويسة', headerPh: 'العنوان، أرقام الهاتف…', footer: 'نص التذييل', footerPh: 'شكراً لزيارتكم!',
    paid: 'مدفوع', showPaid: 'إظهار «مدفوع» تحت المجموع',
    time: 'الوقت', showDate: 'إظهار التاريخ في الفاتورة', showTime: 'إظهار الوقت في الفاتورة',
    accentColor: 'لون التمييز (النصوص)', rowColor: 'لون تعبئة الصفوف الزوجية (A4)',
    paper: 'حجم الورق', paperA4: 'ورقة A4', paperReceipt: 'طابعة إيصالات (80 ملم)',
    lowStockAt: 'التنبيه عند انخفاض المخزون إلى (قطعة)', preview: 'معاينة', dataFolder: 'مجلد البيانات',
    dataNote: 'كل البيانات والصور محفوظة في هذا المجلد. للنسخ الاحتياطي أو النقل انسخ مجلد التطبيق كاملاً.',
    sampleCustomer: 'زبون تجريبي', sampleProduct: 'منتج تجريبي',
    unsaved: 'لديك تغييرات غير محفوظة. هل تريد المغادرة بدون حفظ؟',
    backup: 'النسخ الاحتياطي والنقل', backupSub: 'تصدير كل البيانات أو استعادة نسخة احتياطية',
    exportBackup: 'تصدير كل البيانات', importBackup: 'اختيار نسخة ZIP',
    backupDescription: 'ملف ZIP واحد يضم المنتجات والزبائن والفواتير والإعدادات والصور والشعار وعدادات الفواتير والنسخ اليومية المحفوظة. لا يشمل التعديلات غير المحفوظة أو السلة الحالية.',
    importDescription: 'اختر نسخة مصدّرة من هذا التطبيق وراجعها قبل استبدال بيانات هذا الحاسوب. الاستيراد يستبدل البيانات ولا يدمج متجرين.',
    backupPreparing: 'جارٍ إنشاء النسخة والتحقق منها…', backupDownloading: 'تم التحقق من النسخة وبدأ التنزيل. احتفظ بملف ZIP حتى استيراده في الحاسوب الآخر.',
    importChecking: 'جارٍ رفع النسخة والتحقق من جميع الملفات…', importPreview: 'نسخة تم التحقق منها',
    backupCounts: '{products} منتج · {customers} زبون · {invoices} فاتورة · {images} صورة · {backups} ملف نسخ يومي',
    importReplace: 'استبدال البيانات بهذه النسخة', importConfirm: 'هل تريد استبدال جميع بيانات هذا الحاسوب بالنسخة المحددة؟ ستُحفظ نسخة استرداد كاملة من البيانات الحالية أولاً.',
    importWorking: 'جارٍ حفظ نسخة الاسترداد واستعادة البيانات. أبقِ التطبيق قيد التشغيل…',
    importComplete: 'اكتمل الاستيراد. حُفظت بياناتك السابقة في نسخة الاسترداد التالية:',
    backupWait: 'يرجى الانتظار حتى اكتمال النقل.', backupDate: 'تاريخ التصدير',
    'err.backup': 'تعذّرت معالجة النسخة الاحتياطية.',
    'err.backupBusy': 'هناك عملية نسخ احتياطي أخرى قيد التنفيذ. انتظر وحاول مجدداً.',
    'err.importExpired': 'انتهت صلاحية المعاينة. اختر ملف النسخة مجدداً.',
    'err.importChanged': 'تغيّرت البيانات بعد المعاينة. اختر النسخة مجدداً وراجعها قبل الاستيراد.',
    'err.dataReplaced': 'تغيّرت البيانات أو أُعيد تشغيل التطبيق. حدّث الصفحة قبل الحفظ.',
    'err.importRecovery': 'يلزم إكمال استرداد الاستيراد. أغلق التطبيق وأعد تشغيله. تم الاحتفاظ بنسخ الاسترداد.',
    'err.notFound': 'غير موجود. ربما تم حذفه.',
    'err.badRequest': 'الطلب غير صالح.',
    'err.nameRequired': 'يرجى إدخال الاسم.',
    'err.badPrice': 'يرجى إدخال سعر صحيح (بالدينار بدون كسور).',
    'err.badStock': 'يرجى إدخال عدد قطع صحيح.',
    'err.badQty': 'يرجى إدخال كمية صحيحة.',
    'err.phoneTaken': 'رقم الهاتف هذا مسجل لزبون آخر.',
    'err.customerRequired': 'يرجى إدخال اسم الزبون.',
    'err.cartEmpty': 'السلة فارغة.',
    'err.productGone': 'أحد المنتجات في السلة لم يعد موجوداً.',
    'err.notEnoughStock': 'لا توجد قطع كافية في المخزون. تم تحديث السلة، يرجى مراجعتها.',
    'err.tooLarge': 'المجموع كبير جداً.',
    'err.badImage': 'هذا الملف ليس صورة مدعومة (JPG أو PNG أو WEBP أو GIF).',
    'err.save': 'تعذّر حفظ البيانات في مجلد التطبيق.',
    'err.server': 'حدث خطأ ما.',
    'err.offline': 'التطبيق لا يعمل. شغّله مرة أخرى من مجلد التطبيق.',
    'err.invoiceNumber': 'أدخل رقم فاتورة صحيحاً من 1 إلى 999,999,999.',
    'err.invoiceNumberUsed': 'هذا الرقم أقل من الرقم التالي المتاح. اختر رقماً أكبر أو استخدم الترقيم التلقائي.',
    'err.invoiceYearChanged': 'تغيّرت السنة. حدّث الصفحة واختر رقم الفاتورة مجدداً.',
  },
};

const state = {
  exiting: false,
  db: null,
  appVersion: '',
  dataDir: '',
  generation: null,
  numbering: null,
  invoiceOverride: null,
  pendingSale: null,
  cart: [],                               // [{ productId, qty }]
  cust: { name: '', phone: '', address: '' },
  productSearch: '',
  productSort: 'newest',
  posSearch: '',
};

/* ---------------- helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function lang() { return state.db && state.db.settings.language === 'ar' ? 'ar' : 'en'; }

function t(key, vars) {
  let s = I18N[lang()][key] ?? I18N.en[key] ?? key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Escapes text and keeps groups of numbers such as "0770 123 4567" in
// left-to-right order, so phone numbers do not come out reversed inside
// Arabic lines.
function rich(v) {
  const s = String(v ?? '');
  let out = '', last = 0;
  for (const m of s.matchAll(/\+?\d+(?:[ \-\/.:]\d+)+/g)) {
    out += esc(s.slice(last, m.index)) + `<span dir="ltr">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}

// 25000 -> "25,000 IQD" / "25,000 د.ع"
function money(n) {
  return `<span class="num" dir="ltr">${Number(n || 0).toLocaleString('en-US')}</span> ${t('cur')}`;
}
function moneyText(n) { return `${Number(n || 0).toLocaleString('en-US')} ${t('cur')}`; }
function int(n) { return Number(n || 0).toLocaleString('en-US'); }

function normPhone(v) {
  const s = String(v ?? '').trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
  return (s.startsWith('+') ? '+' : '') + s.replace(/[^0-9]/g, '');
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function invoiceDateTime(iso, settings) {
  const value = fmtDate(iso);
  if (!value) return '';
  const [date, time] = value.split(' ');
  return [settings.showDate !== false ? date : '', settings.showTime !== false ? time : ''].filter(Boolean).join(' ');
}

function imgUrl(name) { return 'images/' + encodeURIComponent(name) + (state.generation ? '?v=' + encodeURIComponent(state.generation) : ''); }

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast-msg' + (isError ? ' error' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), isError ? 6000 : 2500);
}

async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': body instanceof Blob ? body.type : 'application/json',
        ...(state.generation && method !== 'GET' ? { 'X-Inventory-Generation': state.generation } : {}) },
      body: body === undefined ? undefined : (body instanceof Blob ? body : JSON.stringify(body)),
    });
  } catch (e) {
    throw new Error(t('err.offline'));
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty answer */ }
  if (!res.ok) {
    const err = new Error(t(data.error || 'err.server') + (data.error === 'err.backup' && data.detail ? ' ' + data.detail : ''));
    err.key = data.error;
    throw err;
  }
  if (data.db) { state.db = data.db; state.dataDir = data.dataDir; state.numbering = data.numbering || null; state.generation = data.generation; state.appVersion = data.version || ''; }
  return data;
}

const productById = id => state.db.products.find(p => p.id === id);
const lowLimit = () => Number(state.db.settings.lowStock || 0);

function stockBadge(p) {
  if (p.stock <= 0) return `<span class="badge text-bg-danger">${t('outOfStock')}</span>`;
  if (p.stock <= lowLimit()) return `<span class="badge text-bg-warning">${esc(t('inStock', { n: int(p.stock) }))}</span>`;
  return `<span class="badge text-bg-light border">${esc(t('inStock', { n: int(p.stock) }))}</span>`;
}

function matches(q, ...fields) {
  q = q.trim().toLowerCase();
  if (!q) return true;
  return fields.some(f => String(f ?? '').toLowerCase().includes(q));
}

/* ---------------- modal ---------------- */

let modal, modalOpening = false, closeModalOnShown = false;
function openModal(html, opts = {}) {
  const dialog = $('#modal .modal-dialog');
  dialog.className = 'modal-dialog modal-dialog-centered modal-dialog-scrollable' + (opts.size ? ' modal-' + opts.size : '');
  $('#modal-content').innerHTML = html;
  if (!modal) {
    const element = $('#modal');
    element.addEventListener('show.bs.modal', () => { modalOpening = true; });
    element.addEventListener('shown.bs.modal', () => {
      modalOpening = false;
      if (closeModalOnShown) { closeModalOnShown = false; modal.hide(); }
    });
    element.addEventListener('hide.bs.modal', () => { modalOpening = false; closeModalOnShown = false; });
    modal = new bootstrap.Modal(element);
  }
  modal.show();
  return $('#modal-content');
}
function closeModal() {
  if (!modal) return;
  if (modalOpening) closeModalOnShown = true;
  else modal.hide();
}

function confirmBox(message, okText, danger = true) {
  return new Promise(resolve => {
    const box = openModal(`
      <div class="modal-body fs-5 py-4">${esc(message)}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-r="0">${t('cancel')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-brand'}" data-r="1">${esc(okText)}</button>
      </div>`);
    let answer = false;
    box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { answer = b.dataset.r === '1'; closeModal(); });
    $('#modal').addEventListener('hidden.bs.modal', () => resolve(answer), { once: true });
  });
}

/* ---------------- layout ---------------- */

function applyTheme() {
  const theme = state.db.settings.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.bsTheme = theme;
  try { localStorage.setItem('inventory-theme', theme); } catch (err) { /* optional first-paint cache */ }
}

let languageStylesReady = Promise.resolve(true);
function applyLang() {
  const l = lang();
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  const href = l === 'ar' ? 'vendor/bootstrap/bootstrap.rtl.min.css' : 'vendor/bootstrap/bootstrap.min.css';
  const link = $('#bs-css');
  if (!link.href.endsWith(href)) {
    languageStylesReady = new Promise(resolve => {
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
    });
    link.href = href;
  }
  applyTheme();
}

function topbarStyle(settings) {
  const color = safeColor(settings.topbarColor, '#714b67');
  const luminance = hex => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const light = luminance(color);
  const ink = (light + 0.05) / (luminance('#171b22') + 0.05) > 1.05 / (light + 0.05) ? '#171b22' : '#ffffff';
  return `--topbar-bg:${color};--topbar-ink:${ink}`;
}

function topbar(title, extra = '') {
  const s = state.db.settings;
  return `<nav class="topbar no-print" style="${topbarStyle(s)}">
    <a href="#/" class="btn btn-outline-light home-button" aria-label="${esc(t('home'))}" title="${esc(t('home'))}"><i class="bi bi-house-fill" aria-hidden="true"></i><span>${t('home')}</span></a>
    <div class="topbar-heading"><h1>${esc(title)}</h1>${s.storeName ? `<div class="store"><bdi>${esc(s.storeName)}</bdi></div>` : ''}</div>
    <div class="topbar-extra">${extra}</div>
  </nav>`;
}

function appTitle() {
  const name = state.db.settings.storeName;
  const title = [t('appName'), state.appVersion].filter(Boolean).join(' ');
  return name && name !== t('appName') ? title + ' — ' + name : title;
}

/* ---------------- router ---------------- */

let leaveGuard = null; // returns true when the page may be left

const routes = {
  '': renderHome,
  pos: renderPos,
  products: renderProducts,
  customers: renderCustomers,
  invoices: renderInvoices,
  invoice: renderInvoice,
  reports: renderReports,
  settings: renderSettings,
  backup: renderBackup,
};

function route() {
  if (state.exiting) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const fn = routes[parts[0]] || renderHome;
  $('#page-style').textContent = '';
  document.title = appTitle();
  fn(...parts.slice(1));
  window.scrollTo(0, 0);
}

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, '', lastHash);
    return;
  }
  leaveGuard = null;
  lastHash = location.hash;
  route();
});

/* ---------------- home ---------------- */

function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function renderHome() {
  const { products, customers, invoices, settings } = state.db;
  const low = products.filter(p => p.stock <= lowLimit()).length;
  const now = new Date();
  const today = InventoryFinance.summary(invoices, date => isSameDay(new Date(date), now)).net;
  const tile = (href, icon, color, title, sub) => `
    <a class="tile" href="${href}">
      <i class="bi ${icon}" style="color:${color}"></i>
      <div class="tile-title">${esc(title)}</div>
      <div class="tile-sub">${sub}</div>
    </a>`;
  $('#app').innerHTML = `
    <div class="home">
      <div class="home-head">
        <div class="home-brand" dir="ltr">
          ${settings.logo ? `<img src="${imgUrl(settings.logo)}" alt="">` : '<i class="bi bi-shop fs-1 text-brand"></i>'}
          <div class="home-brand-text">
            <h1><bdi>${esc(settings.storeName || t('appName'))}</bdi></h1>
            <div class="small text-secondary">
              ${settings.storeName && settings.storeName !== t('appName') ? `<bdi>${esc(t('appName'))}</bdi>` : ''}
              ${state.appVersion ? `<span class="badge text-bg-light border app-version" dir="ltr">${esc(state.appVersion)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="home-actions">
          <button class="btn btn-outline-secondary language-button" id="lang-btn"><i class="bi bi-translate" aria-hidden="true"></i> ${t('switchLang')}</button>
          <button class="btn btn-outline-secondary theme-button" id="theme-btn" title="${esc(t(settings.theme === 'dark' ? 'lightMode' : 'darkMode'))}" aria-label="${esc(t('toggleTheme'))}" aria-pressed="${settings.theme === 'dark'}"><i class="bi ${settings.theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}" aria-hidden="true"></i></button>
          <button class="btn btn-outline-danger exit-button" id="exit-btn" title="${esc(t('exitApp'))}" aria-label="${esc(t('exitApp'))}"><i class="bi bi-power" aria-hidden="true"></i><span dir="auto">${t('exitLabel')}</span></button>
        </div>
      </div>
      <div class="tiles">
        ${tile('#/pos', 'bi-cart-plus', '#714b67', t('pos'), esc(t('posSub')))}
        ${tile('#/products', 'bi-box-seam', '#0d6efd', t('products'), esc(t('productsSub', { n: int(products.length), low: int(low) })))}
        ${tile('#/customers', 'bi-people', '#198754', t('customers'), esc(t('customersSub', { n: int(customers.length) })))}
        ${tile('#/invoices', 'bi-receipt', '#fd7e14', t('invoices'), esc(t('invoicesSub', { n: int(invoices.length) })))}
        ${tile('#/reports', 'bi-graph-up', '#6f42c1', t('reports'), esc(t('reportsSub', { v: moneyText(today) })))}
        ${tile('#/settings', 'bi-gear', '#6c757d', t('settings'), esc(t('settingsSub')))}
        ${tile('#/backup', 'bi-shield-check', '#198754', t('backup'), esc(t('backupSub')))}
      </div>
    </div>`;
  const savePreference = async changes => {
    const buttons = $$('.home-actions button');
    buttons.forEach(button => { button.disabled = true; });
    try {
      await api('PUT', '/api/settings', { ...state.db.settings, ...changes });
      applyLang(); route();
    } catch (err) {
      toast(err.message, true);
      buttons.forEach(button => { button.disabled = false; });
    }
  };
  $('#lang-btn').onclick = () => savePreference({ language: lang() === 'ar' ? 'en' : 'ar' });
  $('#theme-btn').onclick = () => savePreference({ theme: state.db.settings.theme === 'dark' ? 'light' : 'dark' });
  $('#exit-btn').onclick = exitApp;
}

async function exitApp() {
  if (state.exiting) return;
  if (transferInProgress || checkoutWorking || state.pendingSale) return toast(t('exitBusy'), true);
  if (!await confirmBox(t('exitConfirm'), t('exitApp'))) return;
  state.exiting = true;
  const status = (title, help, spinner = false) => {
    document.title = title + ' — ' + t('appName');
    $('#app').innerHTML = `<main class="page text-center py-5" role="status">${spinner ? '<div class="spinner-border text-brand mb-3" aria-hidden="true"></div>' : '<i class="bi bi-power display-4 text-brand d-block mb-3" aria-hidden="true"></i>'}<h1 class="h3">${esc(title)}</h1><p class="text-secondary">${esc(help)}</p></main>`;
    $('#toasts').replaceChildren();
  };
  status(t('appClosing'), t('appClosingHelp'), true);
  try {
    const result = await api('POST', '/api/exit', {});
    if (!result.closed) throw new Error(t('exitUncertain'));
    state.cart = [];
    leaveGuard = null;
    status(t('appClosed'), t('appClosedHelp'));
  } catch (err) {
    if (err.key) { state.exiting = false; route(); toast(err.message, true); }
    else status(t('exitApp'), t('exitUncertain'));
  }
}

/* ---------------- product cards ---------------- */

function productCard(p, opts = {}) {
  const img = p.images[0]
    ? `<img src="${imgUrl(p.images[0])}" alt="" loading="lazy">`
    : '<i class="bi bi-image"></i>';
  const left = p.stock - (opts.inCart || 0);
  const disabled = opts.pos && left <= 0;
  return `<button type="button" class="pcard${disabled ? ' disabled' : ''}" data-id="${esc(p.id)}">
    <div class="pimg">${img}</div>
    <span class="pstock">${opts.pos ? (left <= 0 ? `<span class="badge text-bg-danger">${t('outOfStock')}</span>` :
      `<span class="badge ${left <= lowLimit() ? 'text-bg-warning' : 'text-bg-light border'}">${int(left)}</span>`) : stockBadge(p)}</span>
    ${opts.inCart ? `<span class="pincart badge rounded-pill" style="background:var(--brand)">${int(opts.inCart)}</span>` : ''}
    <div class="pname"><bdi>${esc(p.name)}</bdi></div>
    <div class="pprice">${money(p.price)}</div>
  </button>`;
}

/* ---------------- products (inventory) ---------------- */

function renderProducts() {
  const sortOptions = [
    ['newest', 'sortNewest'], ['oldest', 'sortOldest'], ['name-asc', 'sortNameAsc'], ['name-desc', 'sortNameDesc'],
    ['price-asc', 'sortPriceAsc'], ['price-desc', 'sortPriceDesc'],
    ['stock-asc', 'sortStockAsc'], ['stock-desc', 'sortStockDesc'],
  ];
  $('#app').innerHTML = `
    ${topbar(t('products'))}
    <div class="page">
      <div class="inventory-toolbar mb-3">
        <div class="input-group inventory-search">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" id="p-search" placeholder="${esc(t('search'))}" value="${esc(state.productSearch)}" dir="auto">
        </div>
        <select class="form-select inventory-sort" id="p-sort" aria-label="${esc(t('sortInventory'))}">
          ${sortOptions.map(([value, key]) => `<option value="${value}"${state.productSort === value ? ' selected' : ''}>${esc(t(key))}</option>`).join('')}
        </select>
        <button class="btn btn-brand text-nowrap" id="p-add"><i class="bi bi-plus-lg"></i> ${t('addProduct')}</button>
      </div>
      <section class="inventory-summary mb-3" aria-label="${esc(t('products'))}">
        <div><span class="text-secondary">${t('inventoryProductCount')}</span><strong class="num" id="p-total-products"></strong></div>
        <div><span class="text-secondary">${t('inventoryPieceCount')}</span><strong class="num" id="p-total-pieces"></strong></div>
      </section>
      <p class="small text-secondary mb-3" id="p-count" role="status" aria-live="polite" aria-atomic="true"></p>
      <div id="p-list"></div>
    </div>`;
  const draw = () => {
    const list = state.db.products.filter(p => matches(state.productSearch, p.name));
    $('#p-total-products').textContent = int(state.db.products.length);
    $('#p-total-pieces').textContent = int(state.db.products.reduce((sum, p) => sum + p.stock, 0));
    $('#p-count').textContent = t('inventoryShowing', { n: int(list.length), total: int(state.db.products.length), pieces: int(list.reduce((sum, p) => sum + p.stock, 0)) });
    const byName = (a, b) => a.name.localeCompare(b.name, lang(), { numeric: true, sensitivity: 'base' });
    const sorts = {
      'name-asc': byName,
      'name-desc': (a, b) => byName(b, a),
      'price-asc': (a, b) => a.price - b.price || byName(a, b),
      'price-desc': (a, b) => b.price - a.price || byName(a, b),
      'stock-asc': (a, b) => a.stock - b.stock || byName(a, b),
      'stock-desc': (a, b) => b.stock - a.stock || byName(a, b),
      newest: (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
      oldest: (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
    };
    if (sorts[state.productSort]) list.sort(sorts[state.productSort]);
    $('#p-list').innerHTML = list.length
      ? `<div class="cards">${list.map(p => productCard(p)).join('')}</div>`
      : `<div class="text-center text-secondary p-5">${state.db.products.length ? t('noResults') : t('noProducts')}</div>`;
    $$('#p-list .pcard').forEach(c => c.onclick = () => productForm(productById(c.dataset.id)));
  };
  $('#p-search').oninput = e => { state.productSearch = e.target.value; draw(); };
  $('#p-sort').onchange = e => { state.productSort = e.target.value; draw(); };
  $('#p-add').onclick = () => productForm(null);
  draw();
}

// Shrinks a picture before upload so the data folder stays small.
// JPEG gets a white background (it has no transparency); PNG keeps it.
function resizeImage(file, maxSide, type) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error(t('err.badImage'))), type, 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('err.badImage'))); };
    img.src = url;
  });
}

async function uploadImage(file, maxSide, type) {
  const blob = await resizeImage(file, maxSide, type);
  const res = await api('POST', '/api/images', blob);
  return res.name;
}

function productForm(p) {
  const draft = p ? { ...p, images: [...p.images] } : { id: '', name: '', price: '', stock: '', images: [] };
  const box = openModal(`
    <div class="modal-header">
      <h5 class="modal-title">${p ? t('editProduct') : t('addProduct')}</h5>
      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <form class="modal-body" id="pf" novalidate>
      <div class="mb-3">
        <label class="form-label">${t('name')}</label>
        <input class="form-control form-control-lg" name="name" required maxlength="200" dir="auto" value="${esc(draft.name)}">
      </div>
      <div class="row g-3 mb-3">
        <div class="col-6">
          <label class="form-label">${t('price')} (${t('cur')})</label>
          <input class="form-control form-control-lg" name="price" inputmode="numeric" dir="ltr" value="${draft.price === '' ? '' : int(draft.price)}">
        </div>
        <div class="col-6">
          <label class="form-label">${t('pieces')}</label>
          <div class="input-group input-group-lg">
            <button class="btn btn-outline-secondary" type="button" data-step="-1"><i class="bi bi-dash-lg"></i></button>
            <input class="form-control text-center" name="stock" inputmode="numeric" dir="ltr" value="${draft.stock === '' ? '' : int(draft.stock)}">
            <button class="btn btn-outline-secondary" type="button" data-step="1"><i class="bi bi-plus-lg"></i></button>
          </div>
        </div>
      </div>
      ${state.db.settings.trackProfit ? `<div class="mb-3">
        <label class="form-label" for="pf-cost">${t('costPrice')} (${t('cur')})</label>
        <input class="form-control form-control-lg" id="pf-cost" name="costPrice" inputmode="numeric" dir="ltr" value="${draft.costPrice == null ? '' : int(draft.costPrice)}">
        <div class="form-text">${t('costHint')}</div>
      </div>` : ''}
      <label class="form-label">${t('pictures')}</label>
      <div class="thumbs mb-2" id="pf-thumbs"></div>
      <label class="btn btn-outline-secondary btn-sm">
        <i class="bi bi-image"></i> ${t('addPictures')}
        <input type="file" accept="image/*" multiple hidden id="pf-files">
      </label>
      <span class="spinner-border spinner-border-sm d-none ms-2" id="pf-spin"></span>
    </form>
    <div class="modal-footer">
      ${p ? `<button class="btn btn-outline-danger me-auto" id="pf-del"><i class="bi bi-trash"></i> ${t('delete')}</button>` : ''}
      <button class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
      <button class="btn btn-brand" id="pf-save"><i class="bi bi-check-lg"></i> ${t('save')}</button>
    </div>`);
  const f = $('#pf', box);

  const drawThumbs = () => {
    $('#pf-thumbs', box).innerHTML = draft.images.map((img, i) => `
      <div class="thumb${i === 0 ? ' main' : ''}">
        <img src="${imgUrl(img)}" alt="">
        ${i > 0 ? `<button type="button" class="tbtn star" data-i="${i}" title="${esc(t('mainPicture'))}"><i class="bi bi-star-fill"></i></button>` : ''}
        <button type="button" class="tbtn del" data-i="${i}" title="${esc(t('removePicture'))}"><i class="bi bi-x-lg"></i></button>
      </div>`).join('');
    $$('.tbtn.del', box).forEach(b => b.onclick = () => { draft.images.splice(+b.dataset.i, 1); drawThumbs(); });
    $$('.tbtn.star', box).forEach(b => b.onclick = () => {
      const [img] = draft.images.splice(+b.dataset.i, 1);
      draft.images.unshift(img);
      drawThumbs();
    });
  };
  drawThumbs();

  $$('[data-step]', box).forEach(b => b.onclick = () => {
    const cur = f.stock.value.trim() === '' ? 0 : parseWhole(f.stock.value);
    if (isNaN(cur) || cur > 1e6) return toast(t('err.badStock'), true);
    const next = Math.max(0, cur + Number(b.dataset.step));
    if (next > 1e6) return toast(t('err.badStock'), true);
    f.stock.value = int(next);
  });
  // Format valid prices only after editing, preserving invalid input for a
  // clear validation error instead of silently turning -5 or 12.5 into 5/125.
  f.price.onblur = () => {
    const v = parseWhole(f.price.value);
    if (!isNaN(v)) f.price.value = int(v);
  };

  $('#pf-files', box).onchange = async e => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    $('#pf-spin', box).classList.remove('d-none');
    for (const file of files) {
      if (draft.images.length >= 10) break;
      try { draft.images.push(await uploadImage(file, 1000, 'image/jpeg')); drawThumbs(); }
      catch (err) { toast(err.message, true); }
    }
    $('#pf-spin', box).classList.add('d-none');
  };

  f.onsubmit = e => { e.preventDefault(); $('#pf-save', box).click(); };
  $('#pf-save', box).onclick = async () => {
    const name = f.name.value.trim();
    const price = parseWhole(f.price.value);
    const stock = parseWhole(f.stock.value);
    const costPrice = f.costPrice ? (f.costPrice.value.trim() === '' ? null : parseWhole(f.costPrice.value)) : draft.costPrice;
    if (costPrice != null && (isNaN(costPrice) || costPrice > 1e9)) return toast(t('err.badCost'), true);
    if (!name) return toast(t('err.nameRequired'), true);
    if (isNaN(price) || price > 1e9) return toast(t('err.badPrice'), true);
    if (isNaN(stock) || stock > 1e6) return toast(t('err.badStock'), true);
    try {
      await api('POST', '/api/products', { id: draft.id, name, price, stock, costPrice, images: draft.images });
      closeModal(); toast(t('saved')); route();
    } catch (err) { toast(err.message, true); }
  };
  if (p) $('#pf-del', box).onclick = async () => {
    if (!await confirmBox(t('confirmDeleteProduct', { name: p.name }), t('delete'))) return;
    try {
      await api('DELETE', '/api/products/' + encodeURIComponent(p.id));
      state.cart = state.cart.filter(l => l.productId !== p.id);
      toast(t('deleted')); route();
    } catch (err) { toast(err.message, true); }
  };
  setTimeout(() => f.name.focus(), 300);
}

/* ---------------- POS (new sale) ---------------- */

const cartQty = id => (state.cart.find(l => l.productId === id) || {}).qty || 0;

// Drops cart lines whose product is gone and caps each line at the stock.
function fixCart() {
  state.cart = state.cart
    .map(l => { const p = productById(l.productId); return p ? { ...l, qty: Math.min(l.qty, p.stock) } : null; })
    .filter(l => l && l.qty > 0);
}

const cartUnitPrice = line => line.customPrice ?? productById(line.productId).price;
function cartTotal() {
  return state.cart.reduce((sum, l) => sum + cartUnitPrice(l) * l.qty, 0);
}

function renderPos() {
  if (state.pendingSale) { renderPendingCheckout(); return; }
  fixCart();
  $('#app').innerHTML = `
    ${topbar(t('pos'))}
    <div class="page pos">
      <div class="pos-products">
        <div class="input-group mb-3">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control form-control-lg" id="pos-search" placeholder="${esc(t('search'))}" value="${esc(state.posSearch)}" dir="auto">
        </div>
        <div id="pos-list"></div>
      </div>
      <div class="pos-cart">
        <div class="p-3 border-bottom">
          <div class="small text-secondary">${t('invoiceNo')}</div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <b class="num" dir="ltr" id="sale-number"></b>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="sale-number-change">${t('changeNumber')}</button>
          </div>
        </div>
        <div class="d-flex align-items-center p-3 border-bottom">
          <h5 class="m-0"><i class="bi bi-cart3"></i> ${t('cart')}</h5>
          <button class="btn btn-sm btn-outline-danger ms-auto" id="cart-clear"><i class="bi bi-trash"></i> ${t('clearCart')}</button>
        </div>
        <div class="cart-lines" id="cart-lines"></div>
        <div class="p-3 border-top">
          <div class="d-flex justify-content-between align-items-baseline mb-3">
            <span class="text-secondary" id="cart-count"></span>
            <span class="cart-total" id="cart-total"></span>
          </div>
          <h6><i class="bi bi-person"></i> ${t('customer')}</h6>
          <div class="customer-picker mb-2">
            <input class="form-control" id="c-name" role="combobox" aria-label="${esc(t('customerName'))}" aria-autocomplete="list" aria-expanded="false" aria-controls="c-options" placeholder="${esc(t('customerSearch'))}" dir="auto" value="${esc(state.cust.name)}" autocomplete="off">
            <div class="customer-options" id="c-options" role="listbox" aria-label="${esc(t('customers'))}" hidden></div>
          </div>
          <input class="form-control mb-2" id="c-phone" placeholder="${esc(t('phone'))}" dir="ltr" inputmode="tel" value="${esc(state.cust.phone)}">
          <textarea class="form-control mb-3" id="c-address" rows="2" placeholder="${esc(t('address'))}" dir="auto">${esc(state.cust.address)}</textarea>
          <button class="btn btn-brand btn-lg w-100" id="sale-btn"><i class="bi bi-check2-circle"></i> ${t('completeSale')}</button>
        </div>
      </div>
    </div>`;

  const drawProducts = () => {
    const list = state.db.products.filter(p => matches(state.posSearch, p.name));
    $('#pos-list').innerHTML = list.length
      ? `<div class="cards">${list.map(p => productCard(p, { pos: true, inCart: cartQty(p.id) })).join('')}</div>`
      : `<div class="text-center text-secondary p-5">${state.db.products.length ? t('noResults') : t('noProducts')}</div>`;
    $$('#pos-list .pcard').forEach(c => c.onclick = () => addToCart(c.dataset.id));
  };

  const drawCart = () => {
    const box = $('#cart-lines');
    if (!state.cart.length) {
      box.innerHTML = `<div class="text-center text-secondary p-4">${t('emptyCart')}</div>`;
    } else {
      box.innerHTML = state.cart.map(l => {
        const p = productById(l.productId);
        return `<div class="cart-line" data-id="${esc(p.id)}">
          <div class="cl-name">
            <div><bdi>${esc(p.name)}</bdi></div>
            <small class="text-secondary">${money(cartUnitPrice(l))} × <span class="num">${int(l.qty)}</span></small>
            <button type="button" class="btn btn-sm btn-link p-0 d-block" data-act="price">${t(l.customPrice === undefined ? 'editSalePrice' : 'customPrice')}</button>
          </div>
          <div class="input-group input-group-sm" style="width:auto">
            <button class="btn btn-outline-secondary" data-act="dec"><i class="bi bi-dash"></i></button>
            <input class="form-control qty" value="${l.qty}" inputmode="numeric" dir="ltr">
            <button class="btn btn-outline-secondary" data-act="inc"><i class="bi bi-plus"></i></button>
          </div>
          <div class="text-end fw-semibold" style="min-width:110px">${money(cartUnitPrice(l) * l.qty)}</div>
          <button class="btn btn-sm text-danger" data-act="del"><i class="bi bi-x-lg"></i></button>
        </div>`;
      }).join('');
    }
    const pieces = state.cart.reduce((s, l) => s + l.qty, 0);
    $('#cart-count').textContent = `${t('items')}: ${int(state.cart.length)} · ${int(pieces)} ${t('pcs')}`;
    $('#cart-total').innerHTML = money(cartTotal());
    $('#sale-btn').disabled = !state.cart.length;

    $$('.cart-line').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-act=price]').onclick = () => {
        const line = state.cart.find(l => l.productId === id);
        const box = openModal(`
          <div class="modal-header"><h5 class="modal-title">${t('customPrice')}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="sale-price-form"><div class="modal-body">
            <p><bdi>${esc(productById(id).name)}</bdi></p>
            <label class="form-label" for="sale-price-input">${t('price')} (${t('cur')})</label>
            <input class="form-control" id="sale-price-input" inputmode="numeric" dir="ltr" value="${cartUnitPrice(line)}">
            <div class="form-text">${t('salePriceHint')}</div>
          </div><div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary me-auto" id="sale-price-reset">${t('regularPrice')} (${money(productById(id).price)})</button>
            <button type="submit" class="btn btn-brand">${t('save')}</button>
          </div></form>`);
        $('#sale-price-reset', box).onclick = () => { delete line.customPrice; closeModal(); drawCart(); };
        $('#sale-price-form', box).onsubmit = e => {
          e.preventDefault();
          const price = parseWhole($('#sale-price-input', box).value);
          if (isNaN(price) || price > 1e9) return toast(t('err.badPrice'), true);
          line.customPrice = price; closeModal(); drawCart();
        };
      };
      row.querySelector('[data-act=dec]').onclick = () => setQty(id, cartQty(id) - 1);
      row.querySelector('[data-act=inc]').onclick = () => setQty(id, cartQty(id) + 1);
      row.querySelector('[data-act=del]').onclick = () => setQty(id, 0);
      row.querySelector('.qty').onchange = e => {
        const v = parseWhole(e.target.value);
        if (isNaN(v)) { e.target.classList.add('is-invalid'); toast(t('err.badQty'), true); return; }
        e.target.classList.remove('is-invalid');
        setQty(id, v);
      };
    });
  };

  const redraw = () => { drawProducts(); drawCart(); };

  const drawInvoiceNumber = () => {
    const choice = state.invoiceOverride;
    $('#sale-number').textContent = choice ? formatInvoiceCode(choice.year, choice.number) : nextInvoiceCode();
  };
  $('#sale-number-change').onclick = () => {
    const numbering = invoiceNumbering();
    const choice = state.invoiceOverride;
    const box = openModal(`
      <div class="modal-header"><h5 class="modal-title">${t('nextInvoiceNumber')}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <form id="number-form">
        <div class="modal-body">
          <label class="form-label" for="number-input" dir="ltr">INV-HS-${numbering.year}-</label>
          <input class="form-control" id="number-input" inputmode="numeric" dir="ltr" value="${choice ? choice.number : numbering.nextNumber}">
          <div class="form-text">${esc(t('numberingMinimum', { code: nextInvoiceCode() }))}</div>
          <p class="small text-secondary mt-2 mb-0">${t('numberingHint')}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary me-auto" id="number-auto">${t('automaticNumber')}</button>
          <button type="submit" class="btn btn-brand">${t('save')}</button>
        </div>
      </form>`);
    $('#number-auto', box).onclick = () => { state.invoiceOverride = null; drawInvoiceNumber(); closeModal(); };
    $('#number-form', box).onsubmit = e => {
      e.preventDefault();
      const number = parseInvoiceNumber($('#number-input', box).value);
      if (!number) return toast(t('err.invoiceNumber'), true);
      if (number < numbering.nextNumber) return toast(t('err.invoiceNumberUsed'), true);
      state.invoiceOverride = { year: numbering.year, number };
      drawInvoiceNumber(); closeModal();
    };
  };
  drawInvoiceNumber();

  function setQty(id, qty) {
    const p = productById(id);
    const line = state.cart.find(l => l.productId === id);
    if (!p || !line) return;
    if (qty > p.stock) { toast(t('onlyLeft', { n: int(p.stock) }), true); qty = p.stock; }
    if (qty <= 0) state.cart = state.cart.filter(l => l.productId !== id);
    else line.qty = qty;
    redraw();
  }

  function addToCart(id) {
    const p = productById(id);
    if (!p) return;
    const line = state.cart.find(l => l.productId === id);
    if ((line ? line.qty : 0) + 1 > p.stock) { toast(p.stock > 0 ? t('onlyLeft', { n: int(p.stock) }) : t('outOfStock'), true); return; }
    if (line) line.qty++; else state.cart.push({ productId: id, qty: 1 });
    redraw();
  }

  $('#pos-search').oninput = e => { state.posSearch = e.target.value; drawProducts(); };
  $('#cart-clear').onclick = () => { state.cart = []; redraw(); };

  // Explicit selection also replaces details from a previously selected customer.
  const nameIn = $('#c-name'), phoneIn = $('#c-phone'), addrIn = $('#c-address');
  const options = $('#c-options');
  let suggestions = [], activeCustomer = -1, selectedCustomer = null;
  const closeCustomers = () => {
    options.hidden = true;
    nameIn.setAttribute('aria-expanded', 'false');
    nameIn.removeAttribute('aria-activedescendant');
    activeCustomer = -1;
  };
  const selectCustomer = c => {
    selectedCustomer = c;
    nameIn.value = state.cust.name = c.name;
    phoneIn.value = state.cust.phone = c.phone;
    addrIn.value = state.cust.address = c.address;
    closeCustomers();
  };
  const showCustomers = () => {
    const q = nameIn.value.trim();
    const phoneQuery = normPhone(q);
    suggestions = state.db.customers.filter(c => matches(q, c.name, c.phone) ||
      (phoneQuery && normPhone(c.phone).includes(phoneQuery)))
      .sort((a, b) => a.name.localeCompare(b.name, lang()));
    activeCustomer = -1;
    nameIn.removeAttribute('aria-activedescendant');
    options.innerHTML = suggestions.length ? suggestions.map((c, i) => `
      <div class="customer-option" role="option" id="c-option-${i}" data-index="${i}" aria-selected="false">
        <bdi>${esc(c.name)}</bdi>
        ${c.phone ? `<small dir="ltr">${esc(c.phone)}</small>` : ''}
        ${c.address ? `<small dir="auto">${esc(c.address)}</small>` : ''}
      </div>`).join('') : `<div class="p-3 small text-secondary" role="status">${esc(t('newCustomerHint'))}</div>`;
    options.hidden = false;
    nameIn.setAttribute('aria-expanded', 'true');
  };
  nameIn.onfocus = showCustomers;
  nameIn.onclick = () => { if (options.hidden) showCustomers(); };
  nameIn.oninput = () => {
    if (selectedCustomer) {
      if (phoneIn.value === selectedCustomer.phone) phoneIn.value = state.cust.phone = '';
      if (addrIn.value === selectedCustomer.address) addrIn.value = state.cust.address = '';
      selectedCustomer = null;
    }
    state.cust.name = nameIn.value;
    showCustomers();
  };
  nameIn.onkeydown = e => {
    if (e.key === 'Escape' || e.key === 'Tab') { closeCustomers(); return; }
    if (e.key === 'Enter' && !options.hidden && activeCustomer >= 0) {
      e.preventDefault(); selectCustomer(suggestions[activeCustomer]); return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (options.hidden) showCustomers();
    if (!suggestions.length) return;
    activeCustomer = activeCustomer < 0 ? (e.key === 'ArrowDown' ? 0 : suggestions.length - 1)
      : (activeCustomer + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    $$('.customer-option', options).forEach((el, i) => {
      el.classList.toggle('active', i === activeCustomer);
      el.setAttribute('aria-selected', String(i === activeCustomer));
    });
    const active = $('#c-option-' + activeCustomer, options);
    nameIn.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  };
  // Keep focus on the combobox while choosing with a mouse or touch.
  options.onmousedown = e => e.preventDefault();
  options.onclick = e => {
    const item = e.target.closest('[data-index]');
    if (item) { selectCustomer(suggestions[Number(item.dataset.index)]); nameIn.focus(); closeCustomers(); }
  };
  nameIn.onblur = closeCustomers;
  phoneIn.oninput = () => {
    state.cust.phone = phoneIn.value;
    const np = normPhone(phoneIn.value);
    const c = np && state.db.customers.find(c => normPhone(c.phone) === np);
    if (c) {
      if (!nameIn.value.trim()) nameIn.value = state.cust.name = c.name;
      if (!addrIn.value.trim()) addrIn.value = state.cust.address = c.address;
    }
  };
  addrIn.oninput = () => { state.cust.address = addrIn.value; };

  $('#sale-btn').onclick = async () => {
    if ($('.qty.is-invalid')) return toast(t('err.badQty'), true);
    if (!state.cart.length) return toast(t('err.cartEmpty'), true);
    if (!state.cust.name.trim()) { nameIn.focus(); return toast(t('err.customerRequired'), true); }
    const choice = state.invoiceOverride;
    await beginSaleCheckout({ customer: state.cust, items: state.cart,
      ...(choice ? { invoiceNumber: choice.number, invoiceYear: choice.year } : {}) });
  };

  redraw();
}

/* ---------------- customers ---------------- */

function customerStats() {
  const stats = {};
  for (const inv of state.db.invoices) {
    const s = stats[inv.customerId] || (stats[inv.customerId] = { count: 0, total: 0 });
    s.count++;
    s.total += InventoryFinance.netTotal(inv);
  }
  return stats;
}

function renderCustomers() {
  let q = '';
  $('#app').innerHTML = `
    ${topbar(t('customers'))}
    <div class="page">
      <div class="d-flex gap-2 mb-3">
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" id="c-search" placeholder="${esc(t('search'))}" dir="auto">
        </div>
        <button class="btn btn-brand text-nowrap" id="c-add"><i class="bi bi-person-plus"></i> ${t('addCustomer')}</button>
      </div>
      <div id="c-table"></div>
    </div>`;
  const draw = () => {
    const stats = customerStats();
    const list = state.db.customers
      .filter(c => matches(q, c.name, c.phone, normPhone(c.phone), c.address))
      .sort((a, b) => a.name.localeCompare(b.name, lang()));
    if (!list.length) {
      $('#c-table').innerHTML = `<div class="text-center text-secondary p-5">${state.db.customers.length ? t('noResults') : t('noCustomers')}</div>`;
      return;
    }
    $('#c-table').innerHTML = `<div class="table-responsive bg-white rounded shadow-sm"><table class="table table-hover align-middle m-0">
      <thead><tr><th>${t('name')}</th><th>${t('phone')}</th><th>${t('address')}</th><th class="text-end">${t('invoicesCount')}</th><th class="text-end">${t('totalSpent')}</th><th></th></tr></thead>
      <tbody>${list.map(c => {
        const s = stats[c.id] || { count: 0, total: 0 };
        return `<tr data-id="${esc(c.id)}">
          <td class="fw-semibold"><bdi>${esc(c.name)}</bdi></td>
          <td class="num"><span dir="ltr">${esc(c.phone)}</span></td>
          <td class="prewrap">${rich(c.address)}</td>
          <td class="text-end num">${int(s.count)}</td>
          <td class="text-end">${money(s.total)}</td>
          <td class="text-end text-nowrap">
            <a class="btn btn-sm btn-outline-secondary" href="#/invoices/${encodeURIComponent(c.id)}" title="${esc(t('viewInvoices'))}"><i class="bi bi-receipt"></i></a>
            <button class="btn btn-sm btn-outline-primary" data-edit title="${esc(t('edit'))}"><i class="bi bi-pencil"></i></button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
    $$('#c-table [data-edit]').forEach(b => b.onclick = () => customerForm(state.db.customers.find(c => c.id === b.closest('tr').dataset.id)));
  };
  $('#c-search').oninput = e => { q = e.target.value; draw(); };
  $('#c-add').onclick = () => customerForm(null);
  draw();
}

function customerForm(c) {
  const box = openModal(`
    <div class="modal-header">
      <h5 class="modal-title">${c ? t('editCustomer') : t('addCustomer')}</h5>
      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <form class="modal-body" id="cf" novalidate>
      <div class="mb-3"><label class="form-label">${t('name')}</label>
        <input class="form-control" name="name" maxlength="200" dir="auto" value="${esc(c ? c.name : '')}"></div>
      <div class="mb-3"><label class="form-label">${t('phone')}</label>
        <input class="form-control" name="phone" maxlength="40" dir="ltr" inputmode="tel" value="${esc(c ? c.phone : '')}"></div>
      <div class="mb-3"><label class="form-label">${t('address')}</label>
        <textarea class="form-control" name="address" rows="2" maxlength="500" dir="auto">${esc(c ? c.address : '')}</textarea></div>
    </form>
    <div class="modal-footer">
      ${c ? `<button class="btn btn-outline-danger me-auto" id="cf-del"><i class="bi bi-trash"></i> ${t('delete')}</button>` : ''}
      <button class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
      <button class="btn btn-brand" id="cf-save"><i class="bi bi-check-lg"></i> ${t('save')}</button>
    </div>`);
  const f = $('#cf', box);
  f.onsubmit = e => { e.preventDefault(); $('#cf-save', box).click(); };
  $('#cf-save', box).onclick = async () => {
    if (!f.name.value.trim()) return toast(t('err.nameRequired'), true);
    try {
      await api('POST', '/api/customers', { id: c ? c.id : '', name: f.name.value, phone: f.phone.value, address: f.address.value });
      closeModal(); toast(t('saved')); route();
    } catch (err) { toast(err.message, true); }
  };
  if (c) $('#cf-del', box).onclick = async () => {
    if (!await confirmBox(t('confirmDeleteCustomer', { name: c.name }), t('delete'))) return;
    try { await api('DELETE', '/api/customers/' + encodeURIComponent(c.id)); toast(t('deleted')); route(); }
    catch (err) { toast(err.message, true); }
  };
  setTimeout(() => f.name.focus(), 300);
}

/* ---------------- invoices ---------------- */

function renderInvoices(customerId) {
  let q = '';
  const cust = customerId && state.db.customers.find(c => c.id === customerId);
  $('#app').innerHTML = `
    ${topbar(t('invoices'))}
    <div class="page">
      ${customerId ? `<div class="alert alert-light border d-flex align-items-center">
        <i class="bi bi-person me-2"></i><span>${t('filterCustomer', { name: `<bdi>${esc(cust ? cust.name : '')}</bdi>` })}</span>
        <a href="#/invoices" class="ms-auto">${t('showAll')}</a></div>` : ''}
      <div class="input-group mb-3">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input class="form-control" id="i-search" placeholder="${esc(t('search'))}" dir="auto">
      </div>
      <div id="i-table"></div>
    </div>`;
  const draw = () => {
    const list = state.db.invoices
      .filter(i => !customerId || i.customerId === customerId)
      .filter(i => matches(q.replace(/^#/, ''), invCode(i), i.customerName, i.customerPhone, normPhone(i.customerPhone)))
      .sort((a, b) => b.number - a.number);
    if (!list.length) {
      $('#i-table').innerHTML = `<div class="text-center text-secondary p-5">${state.db.invoices.length ? t('noResults') : t('noInvoices')}</div>`;
      return;
    }
    const sum = list.reduce((s, i) => s + i.total, 0);
    $('#i-table').innerHTML = `<div class="table-responsive bg-white rounded shadow-sm"><table class="table table-hover table-click align-middle m-0">
      <thead><tr><th>#</th><th>${t('date')}</th><th>${t('customer')}</th><th>${t('phone')}</th><th class="text-end">${t('pcs')}</th><th class="text-end">${t('total')}</th></tr></thead>
      <tbody>${list.map(i => `<tr data-id="${esc(i.id)}">
        <td class="num fw-semibold"><span dir="ltr">${esc(invCode(i))}</span></td>
        <td class="num"><span dir="ltr">${fmtDate(i.date)}</span></td>
        <td><bdi>${esc(i.customerName)}</bdi></td>
        <td class="num"><span dir="ltr">${esc(i.customerPhone)}</span></td>
        <td class="text-end num">${int(i.items.reduce((s, it) => s + it.qty, 0))}</td>
        <td class="text-end fw-semibold">${money(i.total)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr class="table-light"><td colspan="5">${esc(t('shown', { n: int(list.length) }))}</td><td class="text-end fw-bold">${money(sum)}</td></tr></tfoot>
    </table></div>`;
    $$('#i-table tbody tr').forEach(r => r.onclick = () => { location.hash = '#/invoice/' + r.dataset.id; });
  };
  $('#i-search').oninput = e => { q = e.target.value; draw(); };
  draw();
}

// The printed invoice number, e.g. INV-HS-2026-00001 (set by the program).
function invCode(inv) { return inv.code || String(inv.number); }

// What the next invoice will be called; only used for the settings preview.
function invoiceNumbering() {
  if (state.numbering) return state.numbering;
  const y = new Date().getFullYear();
  const used = (state.db.yearCounters || {})[y] || 0;
  return { year: y, nextNumber: used + 1 };
}
function formatInvoiceCode(year, number) { return `INV-HS-${year}-${String(number).padStart(5, '0')}`; }
function nextInvoiceCode() { const n = invoiceNumbering(); return formatInvoiceCode(n.year, n.nextNumber); }

// Builds the printable invoice. Used by the invoice page and the settings preview.
function invoiceHtml(inv, s) {
  const align = ['start', 'center', 'end'].includes(s.logoAlign) ? s.logoAlign : 'center';
  const showName = s.showStoreName && s.storeName;
  const headText = (showName ? `<div class="inv-store"><bdi>${esc(s.storeName)}</bdi></div>` : '') +
    (s.header ? `<div class="prewrap">${rich(s.header)}</div>` : '');
  const logo = s.logo ? `<img src="${imgUrl(s.logo)}" alt="" style="height:${Number(s.logoSize) || 80}px">` : '';
  const pieces = inv.items.reduce((sum, it) => sum + it.qty, 0);
  const style = `--accent:${safeColor(s.accentColor, '#714b67')};--row:${safeColor(s.rowColor, '#f3edf2')}`;
  return `<div class="invoice paper-${s.paper === 'receipt' ? 'receipt' : 'a4'}" data-bs-theme="light" style="${style}">
    ${logo || headText ? `<div class="inv-head align-${align}">${logo}${headText ? `<div class="inv-head-text">${headText}</div>` : ''}</div>` : ''}
    <div class="inv-title"><bdi>${esc(s.invoiceTitle || t('invoice'))}</bdi></div>
    <div class="inv-meta">
      <div>${t('invoiceNo')}: <b class="num" dir="ltr">${esc(invCode(inv))}</b></div>
      ${invoiceDateTime(inv.date, s) ? `<div class="inv-date-time">${t(s.showDate !== false ? 'date' : 'time')}: <b class="num" dir="ltr">${invoiceDateTime(inv.date, s)}</b></div>` : ''}
    </div>
    <div class="inv-cust">
      <div>${t('customer')}: <b><bdi>${esc(inv.customerName)}</bdi></b></div>
      ${inv.customerPhone ? `<div>${t('phone')}: <b dir="ltr" class="num">${esc(inv.customerPhone)}</b></div>` : ''}
      ${inv.customerAddress ? `<div>${t('address')}: <span class="prewrap">${rich(inv.customerAddress)}</span></div>` : ''}
    </div>
    <table class="inv-table">
      <thead><tr><th>#</th><th>${t('product')}</th><th class="r">${t('price')}</th><th class="r">${t('qty')}</th><th class="r">${t('total')}</th></tr></thead>
      <tbody>${inv.items.map((it, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><bdi>${esc(it.name)}</bdi></td>
        <td class="r num">${int(it.price)}</td>
        <td class="r num">${int(it.qty)}</td>
        <td class="r num">${int(it.total)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr class="inv-total">
        <td colspan="3">${t('total')}</td>
        <td class="r num">${int(pieces)}</td>
        <td class="r">${money(inv.total)}</td>
      </tr>${s.showPaid ? `<tr class="inv-paid-row"><td colspan="4" class="inv-blank"></td><td class="inv-paid">${t('paid')}</td></tr>` : ''}</tfoot>
    </table>
    ${s.footer ? `<div class="inv-foot">${rich(s.footer)}</div>` : ''}
  </div>`;
}

// Only a plain #rrggbb value goes into the page, never anything else.
function safeColor(v, fallback) { return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : fallback; }

function pageCss(s) {
  return s.paper === 'receipt'
    ? '@page { size: 80mm auto; margin: 3mm; }'
    : '@page { size: A4; margin: 12mm; }';
}

// Measure and render separate pages so large invoices never require a canvas
// taller than the browser supports. Every page repeats the invoice/table header.
async function downloadInvoicePdf(inv, s) {
  const receipt = s.paper === 'receipt';
  const margin = receipt ? 3 : 12;
  const width = receipt ? 80 : 210;
  const maxHeight = receipt ? 280 : 297;
  const contentWidth = width - margin * 2;
  const contentHeightPx = (maxHeight - margin * 2) * 96 / 25.4;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
  host.setAttribute('aria-hidden', 'true');
  host.dir = lang() === 'ar' ? 'rtl' : 'ltr';
  host.innerHTML = invoiceHtml(inv, s);
  document.body.appendChild(host);
  try {
    // A language switch replaces Bootstrap's stylesheet asynchronously. Measure
    // only after it loads, otherwise page breaks use the wrong font/layout.
    if (!await languageStylesReady) throw new Error('Invoice stylesheet could not be loaded');
    if (document.fonts) await document.fonts.ready;
    await Promise.all($$('img', host).map(img => img.decode()));
    const template = $('.invoice', host);
    template.classList.add('pdf-page');
    template.style.width = `${contentWidth}mm`;
    // Resolve inherited CSS direction explicitly in the PDF library's clone.
    template.dir = host.dir;
    const rows = $$('.inv-table tbody tr', template);
    const totals = $('.inv-table tfoot', template);
    const footer = $('.inv-foot', template);
    rows.forEach(row => row.remove());
    totals.remove();
    if (footer) footer.remove();
    const pages = [];
    const newPage = () => {
      const page = template.cloneNode(true);
      host.appendChild(page);
      pages.push(page);
      return page;
    };
    const fits = page => page.getBoundingClientRect().height <= contentHeightPx - 2;
    let page = newPage();
    for (const row of rows) {
      let body = $('.inv-table tbody', page);
      body.appendChild(row);
      if (!fits(page)) {
        row.remove();
        if (!body.children.length) throw new Error('Invoice header or row exceeds the page height');
        page = newPage();
        $('.inv-table tbody', page).appendChild(row);
        if (!fits(page)) throw new Error('Invoice row exceeds the page height');
      }
    }
    const appendEnding = () => {
      $('.inv-table', page).appendChild(totals);
      if (footer) page.appendChild(footer);
    };
    appendEnding();
    if (!fits(page)) {
      totals.remove();
      if (footer) footer.remove();
      page = newPage();
      appendEnding();
      if (!fits(page)) throw new Error('Invoice footer exceeds the page height');
    }
    template.remove();
    let pdf = null;
    for (const pageElement of pages) {
      // Short receipts use their natural length; long receipts use bounded pages.
      const pageHeight = receipt ? Math.max(80, pageElement.getBoundingClientRect().height * 25.4 / 96 + margin * 2 + 1) : 297;
      const format = receipt ? [80, pageHeight] : 'a4';
      if (!receipt) pageElement.style.minHeight = `${contentHeightPx - 3}px`;
      if (pdf) pdf.addPage(format, 'portrait');
      const worker = html2pdf().set({
        margin, pdf,
        enableLinks: false,
        pagebreak: { mode: [] },
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format, orientation: 'portrait', compress: true },
      });
      try {
        pdf = await worker.from(pageElement).toPdf().get('pdf');
      } finally {
        // The library normally removes its overlay; also clean up after errors.
        const overlay = await worker.get('overlay').catch(() => null);
        if (overlay) overlay.remove();
      }
      pageElement.remove();
    }
    pdf.setProperties({ title: invCode(inv) });
    pdf.save(invCode(inv) + '.pdf');
  } finally {
    host.remove();
  }
}

function renderInvoice(id) {
  const inv = state.db.invoices.find(i => i.id === id);
  if (!inv) {
    $('#app').innerHTML = `${topbar(t('invoice'))}<div class="page text-center text-secondary p-5">${t('invoiceGone')}</div>`;
    return;
  }
  const s = state.db.settings;
  document.title = invCode(inv);
  $('#page-style').textContent = pageCss(s);
  $('#app').innerHTML = `
    ${topbar(t('invoice') + ' ' + invCode(inv))}
    <div class="page">
      <div class="d-flex flex-wrap gap-2 mb-3 no-print">
        <a class="btn btn-outline-secondary" href="#/invoices"><i class="bi bi-arrow-${lang() === 'ar' ? 'right' : 'left'}"></i> ${t('invoices')}</a>
        <a class="btn btn-outline-secondary" href="#/pos"><i class="bi bi-cart-plus"></i> ${t('pos')}</a>
        <button class="btn btn-outline-secondary" id="inv-return"><i class="bi bi-arrow-return-left"></i> ${t('returnItems')}</button>
        <button class="btn btn-outline-danger ms-auto" id="inv-del"${inv.returns?.length ? ' disabled' : ''}><i class="bi bi-trash"></i> ${t('delete')}</button>
        <button class="btn btn-outline-secondary" id="inv-pdf"><i class="bi bi-file-earmark-pdf"></i> ${t('downloadPdf')}</button>
        <button class="btn btn-brand" id="inv-print"><i class="bi bi-printer"></i> ${t('print')}</button>
      </div>
      <section class="bg-white rounded p-3 mb-3 no-print" id="invoice-returns">
        <h5>${t('returns')}</h5>
        ${(inv.returns || []).map(ret => `<div class="border-bottom py-2">
          <div class="d-flex justify-content-between gap-2"><span dir="ltr">${esc(fmtDate(ret.date))}</span><strong>${money(ret.total)}</strong></div>
          <ul class="mb-1">${ret.items.map(item => `<li><bdi>${esc(inv.items[item.index].name)}</bdi> × ${int(item.qty)}</li>`).join('')}</ul>
          <small class="text-secondary">${ret.restock ? t('restockReturn') : t('noRestock')}</small>
        </div>`).join('') || `<p class="text-secondary mb-0">${t('noReturns')}</p>`}
        ${inv.returns?.length ? `<div class="mt-2">${t('refundTotal')}: ${money(InventoryFinance.refundTotal(inv))} · ${t('netSales')}: ${money(InventoryFinance.netTotal(inv))}</div>` : ''}
      </section>
      ${invoiceHtml(inv, s)}
    </div>`;
  $('#inv-print').onclick = () => window.print();
  $('#inv-return').onclick = () => returnForm(inv);
  $('#inv-pdf').onclick = async e => {
    const button = e.currentTarget;
    const label = button.innerHTML;
    button.disabled = true;
    button.textContent = t('creatingPdf');
    try {
      await downloadInvoicePdf(inv, s);
    } catch (err) {
      toast(t('pdfError'), true);
    } finally {
      button.disabled = false;
      button.innerHTML = label;
    }
  };
  $('#inv-del').onclick = () => {
    const box = openModal(`
      <div class="modal-header"><h5 class="modal-title">${t('deleteInvoice')}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <p class="fs-5">${esc(t('deleteInvoiceQ', { n: invCode(inv) }))}</p>
        <div class="d-grid gap-2">
          <button class="btn btn-danger" data-restock="1"><i class="bi bi-arrow-counterclockwise"></i> ${t('deleteRestock')}</button>
          <button class="btn btn-outline-danger" data-restock="0"><i class="bi bi-trash"></i> ${t('deleteOnly')}</button>
          <button class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
        </div>
      </div>`);
    $$('[data-restock]', box).forEach(b => b.onclick = async () => {
      try {
        await api('DELETE', `/api/invoices/${encodeURIComponent(inv.id)}?restock=${b.dataset.restock}`);
        closeModal(); toast(t('deleted')); location.hash = '#/invoices';
      } catch (err) { toast(err.message, true); }
    });
  };
}

function returnForm(inv) {
  const key = 'inventory-pending-return:' + state.dataDir + ':' + state.generation + ':' + inv.id;
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
  const box = openModal(`
    <div class="modal-header"><h5 class="modal-title">${t('returnItems')} · ${esc(invCode(inv))}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
    <form id="return-form"><div class="modal-body">
      <p class="text-secondary">${t('returnHint')}</p>
      <fieldset id="return-fields">
        ${inv.items.map((item, index) => {
          const remaining = item.qty - InventoryFinance.returnedQty(inv, index);
          return `<div class="row g-2 align-items-center mb-3"><div class="col-7"><bdi>${esc(item.name)}</bdi><div class="small text-secondary">${t('remaining')}: ${int(remaining)} · ${money(item.price)}</div></div>
            <div class="col-5"><label class="form-label small" for="return-${index}">${t('returnQty')}</label><input class="form-control" id="return-${index}" data-return-index="${index}" inputmode="numeric" dir="ltr" value="0"${remaining === 0 ? ' disabled' : ''}></div></div>`;
        }).join('')}
        <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="return-restock" checked><label class="form-check-label" for="return-restock">${t('restockReturn')}</label></div>
      </fieldset>
      <div class="fs-5">${t('refundTotal')}: <strong id="return-total"></strong></div>
      <div class="alert alert-warning mt-3" id="return-pending" hidden>${t('returnPending')}</div>
    </div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button><button class="btn btn-brand" id="return-save" type="submit">${t('recordReturn')}</button></div></form>`, { size: 'lg' });
  const inputs = $$('[data-return-index]', box);
  const drawTotal = () => {
    const total = inputs.reduce((sum, input) => {
      const qty = parseWhole(input.value);
      return sum + (Number.isNaN(qty) ? 0 : qty * inv.items[Number(input.dataset.returnIndex)].price);
    }, 0);
    $('#return-total', box).innerHTML = money(total);
  };
  const restorePending = () => {
    if (!pending) return;
    inputs.forEach(input => { input.value = pending.items.find(item => item.index === Number(input.dataset.returnIndex))?.qty || 0; });
    $('#return-restock', box).checked = pending.restock;
    $('#return-fields', box).disabled = true;
    $('#return-pending', box).hidden = false;
    $('#return-save', box).textContent = t('returnRetry');
  };
  restorePending(); drawTotal();
  $('#return-form', box).oninput = drawTotal;
  $('#return-form', box).onsubmit = async e => {
    e.preventDefault();
    const button = $('#return-save', box);
    if (!pending) {
      const items = [];
      for (const input of inputs) {
        const qty = parseWhole(input.value);
        const index = Number(input.dataset.returnIndex);
        if (Number.isNaN(qty) || qty > inv.items[index].qty - InventoryFinance.returnedQty(inv, index)) return toast(t('err.badReturn'), true);
        if (qty) items.push({ index, qty });
      }
      if (!items.length) return toast(t('err.badReturn'), true);
      const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      pending = { requestId, items, restock: $('#return-restock', box).checked };
      try { sessionStorage.setItem(key, JSON.stringify(pending)); }
      catch { pending = null; return toast(t('err.checkoutStorage'), true); }
    }
    button.disabled = true;
    $('#return-fields', box).disabled = true;
    try {
      await api('POST', `/api/invoices/${encodeURIComponent(inv.id)}/returns`, pending);
      sessionStorage.removeItem(key);
      closeModal(); toast(t('returnSaved')); renderInvoice(inv.id);
    } catch (err) {
      if (err.key) {
        pending = null; sessionStorage.removeItem(key);
        $('#return-fields', box).disabled = false;
        $('#return-pending', box).hidden = true;
        button.textContent = t('recordReturn');
      } else restorePending();
      toast(err.message, true);
    } finally { button.disabled = false; }
  };
}

/* ---------------- reports ---------------- */

function renderReports() {
  const { invoices, products } = state.db;
  const now = new Date();
  const today = InventoryFinance.summary(invoices, date => isSameDay(new Date(date), now));
  const month = InventoryFinance.summary(invoices, date => { const d = new Date(date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const all = InventoryFinance.summary(invoices);
  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const stockPieces = products.reduce((s, p) => s + p.stock, 0);
  const low = products.filter(p => p.stock <= lowLimit()).sort((a, b) => a.stock - b.stock);

  // Best sellers, grouped by product. The name shown is the current one
  // when the product still exists, otherwise the name on the last invoice.
  const sold = {};
  for (const inv of invoices) for (const [index, it] of inv.items.entries()) {
    const r = sold[it.productId] || (sold[it.productId] = { name: it.name, qty: 0, total: 0 });
    const qty = it.qty - InventoryFinance.returnedQty(inv, index);
    r.qty += qty; r.total += it.price * qty; r.name = it.name;
  }
  const top = Object.entries(sold)
    .map(([id, r]) => ({ ...r, name: (productById(id) || r).name }))
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.total - a.total)
    .slice(0, 10);

  const card = (icon, title, value, sub) => `<div class="col-sm-6 col-lg-3"><div class="bg-white rounded shadow-sm p-3 h-100">
    <div class="text-secondary"><i class="bi ${icon}"></i> ${esc(title)}</div>
    <div class="fs-4 fw-bold my-1">${value}</div><div class="small text-secondary">${esc(sub)}</div></div></div>`;

  $('#app').innerHTML = `
    ${topbar(t('reports'))}
    <div class="page">
      <div class="row g-3 mb-4">
        ${card('bi-calendar-day', t('today'), money(today.net), t('salesCount', { n: int(today.count) }))}
        ${card('bi-calendar-month', t('thisMonth'), money(month.net), t('salesCount', { n: int(month.count) }))}
        ${card('bi-graph-up', t('allTime'), money(all.net), t('salesCount', { n: int(all.count) }))}
        ${card('bi-box-seam', t('stockValue'), money(stockValue), t('stockPieces', { n: int(stockPieces) }))}
      </div>
      <p class="small text-secondary">${t('netSalesHint')}</p>
      ${state.db.settings.trackProfit ? `<section class="mb-4" id="profit-report">
        <h5>${t('grossProfit')}</h5><p class="text-secondary">${t('profitHint')}</p>
        <div class="row g-3">
          ${[[t('today'), today], [t('thisMonth'), month], [t('allTime'), all]].map(([title, stats]) => card('bi-cash-coin', title, stats.hasCosts ? money(stats.profit) : '—', t('excludedRevenue', { v: moneyText(stats.excluded) }))).join('')}
        </div>
      </section>` : ''}
      <div class="row g-3">
        <div class="col-lg-6"><div class="bg-white rounded shadow-sm p-3 h-100">
          <h6><i class="bi bi-trophy"></i> ${t('topProducts')}</h6>
          ${top.length ? `<table class="table table-sm m-0"><thead><tr><th>${t('product')}</th><th class="text-end">${t('soldQty')}</th><th class="text-end">${t('revenue')}</th></tr></thead>
            <tbody>${top.map(r => `<tr><td><bdi>${esc(r.name)}</bdi></td><td class="text-end num">${int(r.qty)}</td><td class="text-end">${money(r.total)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="text-secondary">${t('nothing')}</div>`}
        </div></div>
        <div class="col-lg-6"><div class="bg-white rounded shadow-sm p-3 h-100">
          <h6><i class="bi bi-exclamation-triangle text-warning"></i> ${t('lowStockList')} (≤ ${int(lowLimit())})</h6>
          ${low.length ? `<table class="table table-sm m-0"><tbody>${low.map(p => `<tr><td><bdi>${esc(p.name)}</bdi></td><td class="text-end">${stockBadge(p)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="text-secondary">${t('nothing')}</div>`}
        </div></div>
      </div>
    </div>`;
}

/* ---------------- settings ---------------- */

function renderSettings() {
  const headerPresets = [['#a6e3e1', 'presetMint'], ['#714b67', 'presetPurple'], ['#334155', 'presetSlate'], ['#245a81', 'presetBlue'], ['#28634c', 'presetGreen'], ['#353a43', 'presetCharcoal']];
  const saved = JSON.stringify(state.db.settings);
  const d = JSON.parse(saved); // draft
  const numbering = { ...invoiceNumbering() };
  const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  $('#app').innerHTML = `
    ${topbar(t('settings'))}
    <div class="page">
      <div class="row g-4">
        <div class="col-lg-5">
          <form id="sf" class="bg-white rounded shadow-sm p-3" novalidate>
            <h5 class="mb-3">${t('general')}</h5>
            <fieldset class="mb-4">
              <legend class="h6">${t('topbarTheme')}</legend>
              <label class="form-label" for="sf-topbar-color">${t('topbarColor')}</label>
              <div class="d-flex align-items-center gap-2">
                <input type="color" class="form-control form-control-color" id="sf-topbar-color" name="topbarColor" value="${safeColor(d.topbarColor, '#714b67')}">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="sf-topbar-reset">${t('resetTopbar')}</button>
              </div>
              <div class="form-text">${t('topbarHint')}</div>
              <div class="header-presets mt-3" role="group" aria-label="${esc(t('headerPresets'))}">
                ${headerPresets.map(([color, label]) => `<button type="button" class="btn btn-outline-secondary header-preset" data-header-color="${color}" aria-pressed="false"><span class="header-swatch" style="background:${color}" aria-hidden="true"></span>${t(label)}</button>`).join('')}
                <button type="button" class="btn btn-outline-secondary header-preset" id="sf-topbar-custom" aria-pressed="false"><i class="bi bi-palette" aria-hidden="true"></i>${t('customHeaderColor')}</button>
              </div>
            </fieldset>
            <div class="form-check form-switch mb-3">
              <input class="form-check-input" type="checkbox" name="trackProfit" id="sf-profit"${d.trackProfit ? ' checked' : ''}>
              <label class="form-check-label" for="sf-profit">${t('trackProfit')}</label>
              <div class="form-text">${t('trackProfitHint')}</div>
            </div>
            <div class="mb-3"><label class="form-label">${t('language')}</label>
              <select class="form-select" name="language">${opt('en', 'English', d.language)}${opt('ar', 'العربية', d.language)}</select></div>
            <div class="mb-3"><label class="form-label">${t('storeName')}</label>
              <input class="form-control" name="storeName" maxlength="200" dir="auto" value="${esc(d.storeName)}"></div>
            <div class="mb-3"><label class="form-label">${t('lowStockAt')}</label>
              <input class="form-control" name="lowStock" inputmode="numeric" dir="ltr" value="${int(d.lowStock)}"></div>

            <div class="mb-3">
              <label class="form-label" for="sf-next-number">${t('nextInvoiceNumber')} (${numbering.year})</label>
              <div class="input-group" dir="ltr"><span class="input-group-text">INV-HS-${numbering.year}-</span>
                <input class="form-control" id="sf-next-number" name="nextInvoiceNumber" inputmode="numeric" value="${numbering.nextNumber}"></div>
              <div class="form-text">${t('numberingHint')}</div>
            </div>

            <h5 class="mt-4 mb-3">${t('logo')}</h5>
            <div class="d-flex gap-2 mb-3 align-items-center">
              <label class="btn btn-outline-secondary"><i class="bi bi-upload"></i> ${t('uploadLogo')}
                <input type="file" accept="image/*" hidden id="sf-logo"></label>
              <button type="button" class="btn btn-outline-danger" id="sf-logo-del"><i class="bi bi-x-lg"></i> ${t('removeLogo')}</button>
              <span class="spinner-border spinner-border-sm d-none" id="sf-spin"></span>
            </div>
            <div class="mb-3"><label class="form-label">${t('logoSize')}: <span id="sf-size-v" class="num">${d.logoSize}</span> px</label>
              <input type="range" class="form-range" name="logoSize" min="20" max="300" step="5" value="${d.logoSize}"></div>
            <div class="mb-3"><label class="form-label">${t('logoAlign')}</label>
              <select class="form-select" name="logoAlign">${opt('start', t('alignStart'), d.logoAlign)}${opt('center', t('alignCenter'), d.logoAlign)}${opt('end', t('alignEnd'), d.logoAlign)}</select></div>

            <h5 class="mt-4 mb-3">${t('invoiceDesign')}</h5>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showStoreName" id="sf-show"${d.showStoreName ? ' checked' : ''}>
              <label class="form-check-label" for="sf-show">${t('showStoreName')}</label></div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showPaid" id="sf-paid"${d.showPaid ? ' checked' : ''}>
              <label class="form-check-label" for="sf-paid">${t('showPaid')}</label></div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showDate" id="sf-date"${d.showDate !== false ? ' checked' : ''}>
              <label class="form-check-label" for="sf-date">${t('showDate')}</label></div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showTime" id="sf-time"${d.showTime !== false ? ' checked' : ''}>
              <label class="form-check-label" for="sf-time">${t('showTime')}</label></div>
            <div class="row g-3 mb-3">
              <div class="col-6"><label class="form-label">${t('accentColor')}</label>
                <input type="color" class="form-control form-control-color w-100" name="accentColor" value="${esc(d.accentColor)}"></div>
              <div class="col-6"><label class="form-label">${t('rowColor')}</label>
                <input type="color" class="form-control form-control-color w-100" name="rowColor" value="${esc(d.rowColor)}"></div>
            </div>
            <div class="mb-3"><label class="form-label">${t('invoiceTitle')}</label>
              <input class="form-control" name="invoiceTitle" maxlength="100" dir="auto" placeholder="${esc(t('invoiceTitlePh'))}" value="${esc(d.invoiceTitle)}"></div>
            <div class="mb-3"><label class="form-label">${t('header')}</label>
              <textarea class="form-control" name="header" rows="3" dir="auto" placeholder="${esc(t('headerPh'))}">${esc(d.header)}</textarea></div>
            <div class="mb-3"><label class="form-label">${t('footer')}</label>
              <textarea class="form-control" name="footer" rows="3" dir="auto" placeholder="${esc(t('footerPh'))}">${esc(d.footer)}</textarea></div>
            <div class="mb-3"><label class="form-label">${t('paper')}</label>
              <select class="form-select" name="paper">${opt('a4', t('paperA4'), d.paper)}${opt('receipt', t('paperReceipt'), d.paper)}</select></div>

            <button class="btn btn-brand btn-lg w-100" id="sf-save"><i class="bi bi-check-lg"></i> ${t('save')}</button>

            <div class="mt-4 small text-secondary">
              <div class="fw-semibold"><i class="bi bi-folder2-open"></i> ${t('dataFolder')}</div>
              <div dir="ltr" class="text-start text-break"><code>${esc(state.dataDir)}</code></div>
              <div>${t('dataNote')}</div>
            </div>
          </form>
          <a class="btn btn-outline-secondary w-100 mt-3" href="#/backup"><i class="bi bi-shield-check"></i> ${t('backup')}</a>
        </div>
        <div class="col-lg-7">
          <h5>${t('preview')}</h5>
          <div id="sf-preview"></div>
        </div>
      </div>
    </div>`;

  const f = $('#sf');
  const sample = {
    code: nextInvoiceCode(), date: new Date().toISOString(),
    customerName: t('sampleCustomer'), customerPhone: '0770 000 0000', customerAddress: lang() === 'ar' ? 'بغداد' : 'Baghdad',
    items: [
      { name: t('sampleProduct') + ' 1', price: 25000, qty: 2, total: 50000 },
      { name: t('sampleProduct') + ' 2', price: 7500, qty: 3, total: 22500 },
      { name: t('sampleProduct') + ' 3', price: 12000, qty: 1, total: 12000 },
    ],
    total: 84500, // 50,000 + 22,500 + 12,000
  };
  const preview = () => {
    $('#sf-preview').innerHTML = invoiceHtml(sample, d);
    $('.topbar').style.cssText = topbarStyle(d);
    $$('[data-header-color]').forEach(button => {
      const selected = button.dataset.headerColor === safeColor(d.topbarColor, '#714b67').toLowerCase();
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const customSelected = !headerPresets.some(([color]) => color === safeColor(d.topbarColor, '#714b67').toLowerCase());
    $('#sf-topbar-custom').classList.toggle('active', customSelected);
    $('#sf-topbar-custom').setAttribute('aria-pressed', String(customSelected));
    const storeLabel = $('.topbar .store bdi');
    if (storeLabel) storeLabel.textContent = d.storeName;
  };
  const read = () => {
    d.topbarColor = f.topbarColor.value;
    d.trackProfit = f.trackProfit.checked;
    d.language = f.language.value;
    d.storeName = f.storeName.value;
    const low = parseWhole(f.lowStock.value);
    if (!isNaN(low)) d.lowStock = low;
    d.logoSize = Number(f.logoSize.value);
    d.logoAlign = f.logoAlign.value;
    d.showStoreName = f.showStoreName.checked;
    d.invoiceTitle = f.invoiceTitle.value;
    d.header = f.header.value;
    d.footer = f.footer.value;
    d.paper = f.paper.value;
    d.showPaid = f.showPaid.checked;
    d.showDate = f.showDate.checked;
    d.showTime = f.showTime.checked;
    d.accentColor = f.accentColor.value;
    d.rowColor = f.rowColor.value;
    const next = parseInvoiceNumber(f.nextInvoiceNumber.value);
    sample.code = next ? formatInvoiceCode(numbering.year, next) : nextInvoiceCode();
    $('#sf-size-v').textContent = d.logoSize;
    preview();
  };
  f.oninput = read;
  f.onchange = read;
  $('#sf-topbar-reset').onclick = () => { f.topbarColor.value = '#714b67'; read(); };
  $$('[data-header-color]').forEach(button => { button.onclick = () => { f.topbarColor.value = button.dataset.headerColor; read(); }; });
  $('#sf-topbar-custom').onclick = () => {
    const picker = f.topbarColor;
    picker.focus();
    if (typeof picker.showPicker === 'function') picker.showPicker();
    else picker.click();
  };
  f.onsubmit = async e => {
    e.preventDefault();
    read();
    const low = parseWhole(f.lowStock.value);
    if (isNaN(low) || low > 1e6) { f.lowStock.focus(); return toast(t('err.badStock'), true); }
    const next = parseInvoiceNumber(f.nextInvoiceNumber.value);
    if (!next) return toast(t('err.invoiceNumber'), true);
    if (next < numbering.nextNumber) return toast(t('err.invoiceNumberUsed'), true);
    const button = $('#sf-save');
    button.disabled = true;
    try {
      await api('PUT', '/api/settings', { ...d,
        ...(next !== numbering.nextNumber ? { nextInvoiceNumber: next, invoiceYear: numbering.year } : {}) });
      leaveGuard = null;
      applyLang(); toast(t('saved')); route();
    } catch (err) { toast(err.message, true); }
    finally { button.disabled = false; }
  };
  $('#sf-logo').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('#sf-spin').classList.remove('d-none');
    try { d.logo = await uploadImage(file, 600, 'image/png'); preview(); }
    catch (err) { toast(err.message, true); }
    $('#sf-spin').classList.add('d-none');
  };
  $('#sf-logo-del').onclick = () => { d.logo = ''; preview(); };

  leaveGuard = () => (JSON.stringify(d) === saved && parseInvoiceNumber(f.nextInvoiceNumber.value) === numbering.nextNumber) || confirm(t('unsaved'));
  preview();
}

/* ---------------- full backup and restore ---------------- */

let transferInProgress = false;
window.addEventListener('beforeunload', e => {
  if (transferInProgress) { e.preventDefault(); e.returnValue = ''; }
});

function renderBackup(recoveryBackup = '') {
  let pendingToken = null;
  $('#app').innerHTML = `
    ${topbar(t('backup'))}
    <div class="page" style="max-width:1000px">
      ${recoveryBackup ? `<div class="alert alert-success" role="status">${t('importComplete')}<div class="mt-2 text-break" dir="ltr"><code>${esc(recoveryBackup)}</code></div></div>` : ''}
      <div class="row g-3">
        <div class="col-md-6"><section class="bg-white rounded shadow-sm p-4 h-100">
          <h4><i class="bi bi-download"></i> ${t('exportBackup')}</h4>
          <p class="text-secondary">${t('backupDescription')}</p>
          <button class="btn btn-brand" id="backup-export">${t('exportBackup')}</button>
        </section></div>
        <div class="col-md-6"><section class="bg-white rounded shadow-sm p-4 h-100">
          <h4><i class="bi bi-upload"></i> ${t('importBackup')}</h4>
          <p class="text-secondary">${t('importDescription')}</p>
          <label class="form-label" for="backup-file">${t('importBackup')}</label>
          <input type="file" class="form-control" id="backup-file" accept=".zip,application/zip">
        </section></div>
      </div>
      <div class="my-3" id="backup-status" role="status" aria-live="polite"></div>
      <div id="backup-preview"></div>
    </div>`;
  const status = $('#backup-status');
  const preview = $('#backup-preview');
  const setBusy = (busy, text = '') => {
    transferInProgress = busy;
    $('#backup-export').disabled = busy;
    $('#backup-file').disabled = busy;
    $$('button', preview).forEach(button => { button.disabled = busy; });
    status.textContent = text;
    status.className = 'my-3';
  };
  const showError = err => {
    setBusy(false, err.message);
    status.classList.add('text-danger');
  };
  const cancelPreview = async () => {
    const token = pendingToken;
    pendingToken = null;
    if (token) {
      try { await api('DELETE', '/api/backups/import/' + encodeURIComponent(token)); }
      catch (err) { /* expires automatically if cancellation cannot reach the app */ }
    }
    preview.innerHTML = '';
  };
  leaveGuard = () => {
    if (transferInProgress) { toast(t('backupWait')); return false; }
    cancelPreview();
    return true;
  };
  $('#backup-export').onclick = async () => {
    setBusy(true, t('backupPreparing'));
    try {
      const result = await api('POST', '/api/backups/export', {});
      // Let the browser stream the file to disk rather than buffering a large
      // backup in JavaScript memory. Server generation/verification is finished.
      const link = document.createElement('a');
      link.href = '/api/backups/download/' + encodeURIComponent(result.token);
      link.download = result.filename;
      document.body.appendChild(link);
      link.click(); link.remove();
      setBusy(false, t('backupDownloading'));
    } catch (err) { showError(err); }
  };
  $('#backup-file').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true, t('importChecking'));
    await cancelPreview();
    try {
      if (!file.size || file.size > 2 * 1024 ** 3) throw new Error(t('err.backup'));
      const result = await api('POST', '/api/backups/import/preview', new Blob([file], { type: 'application/zip' }));
      pendingToken = result.token;
      const summary = result.summary;
      preview.innerHTML = `<section class="bg-white border rounded p-4">
        <h4>${t('importPreview')}</h4>
        <h5><bdi>${esc(summary.storeName)}</bdi></h5>
        <p>${esc(t('backupCounts', summary))}</p>
        <p>${t('backupDate')}: <span dir="ltr">${esc(fmtDate(summary.createdAt))}</span></p>
        <p class="text-danger">${t('importDescription')}</p>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-danger" id="backup-commit">${t('importReplace')}</button>
          <button class="btn btn-outline-secondary" id="backup-cancel">${t('cancel')}</button>
        </div>
      </section>`;
      $('#backup-cancel').onclick = async () => { await cancelPreview(); status.textContent = ''; };
      $('#backup-commit').onclick = async () => {
        if (transferInProgress || !pendingToken) return;
        setBusy(true);
        if (!await confirmBox(t('importConfirm'), t('importReplace'))) { setBusy(false); return; }
        setBusy(true, t('importWorking'));
        try {
          const restored = await api('POST', '/api/backups/import/commit', { token: pendingToken });
          pendingToken = null;
          clearPendingCheckout();
          state.cart = [];
          state.cust = { name: '', phone: '', address: '' };
          state.invoiceOverride = null;
          state.productSearch = state.posSearch = '';
          transferInProgress = false;
          leaveGuard = null;
          applyLang();
          document.title = appTitle();
          renderBackup(restored.recoveryBackup);
        } catch (err) {
          await cancelPreview();
          showError(err);
        }
      };
      setBusy(false);
    } catch (err) { showError(err); }
  };
}

/* ---------------- start ---------------- */

(async function start() {
  try {
    await api('GET', '/api/data');
  } catch (e) {
    $('#app').innerHTML = `<div class="p-5 text-center text-danger">${esc(e.message)}</div>`;
    return;
  }
  applyLang();
  if (restorePendingCheckout()) location.hash = '#/pos';
  route();
})();
