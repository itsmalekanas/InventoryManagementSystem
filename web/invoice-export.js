'use strict';

// Measure and render separate pages so large invoices never require a canvas
// taller than the browser supports. Every page repeats the invoice/table header.
async function downloadInvoicePdf(inv, s) {
  const receipt = s.paper === 'receipt';
  const margin = receipt ? 3 : a4Layout(s).margin;
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

async function downloadInvoicePng(inv, s) {
  const receipt = s.paper === 'receipt';
  const host = document.createElement('div');
  host.className = 'invoice-png-host';
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
  host.setAttribute('aria-hidden', 'true');
  host.dir = lang() === 'ar' ? 'rtl' : 'ltr';
  host.innerHTML = invoiceHtml(inv, s);
  document.body.appendChild(host);
  let worker;
  try {
    if (!await languageStylesReady) throw new Error('Invoice stylesheet could not be loaded');
    const invoice = $('.invoice', host);
    invoice.style.width = receipt ? '80mm' : '210mm';
    invoice.style.maxWidth = 'none';
    invoice.style.boxShadow = 'none';
    invoice.dir = host.dir;
    if (document.fonts) await document.fonts.ready;
    await Promise.all($$('img', host).map(img => img.decode()));
    const { width, height } = invoice.getBoundingClientRect();
    // Export the whole invoice as one image, reducing resolution for long lists
    // to stay within browser canvas dimensions and a bounded pixel budget.
    const scale = Math.min(2, 16384 / Math.max(width, height), Math.sqrt(32000000 / (width * height)));
    worker = html2pdf().set({ margin: 0, enableLinks: false, pagebreak: { mode: [] },
      html2canvas: { scale, backgroundColor: '#ffffff', logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: receipt ? [80, 297] : 'a4', orientation: 'portrait' },
    });
    const canvas = await worker.from(invoice).toCanvas().get('canvas');
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = invCode(inv) + '.png';
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  } finally {
    if (worker) {
      const overlay = await worker.get('overlay').catch(() => null);
      if (overlay) overlay.remove();
    }
    host.remove();
  }
}

let invoiceExportInProgress = false;
