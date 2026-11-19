'use strict';

/* ---------------- settings ---------------- */

function renderSettings() {
  const pickerHtml = (name, value, label, options) => InventoryColorPicker.html(name, safeColor(value, '#714b67'), esc(label), {
    hue: esc(t('colorHue')), saturation: esc(t('colorSaturation')), brightness: esc(t('colorBrightness')), hex: esc(t('colorHex')),
  }, options);
  const headerPresets = [['#a6e3e1', 'presetMint'], ['#714b67', 'presetPurple'], ['#334155', 'presetSlate'], ['#245a81', 'presetBlue'], ['#28634c', 'presetGreen'], ['#353a43', 'presetCharcoal']];
  const saved = JSON.stringify(state.db.settings);
  const savedSettingsToken = state.settingsToken;
  let logoUploads = 0, settingsSaving = false;
  settingsBusy = () => logoUploads > 0 || settingsSaving;
  const d = JSON.parse(saved); // draft
  const layout = a4Layout(d);
  const layoutRanges = { margin: [5, 30, 'a4Margin'], fontSize: [10, 22, 'a4FontSize'], storeSize: [14, 40, 'a4StoreSize'], titleSize: [14, 36, 'a4TitleSize'], headerGap: [0, 48, 'a4HeaderGap'], footerGap: [0, 48, 'a4FooterGap'] };
  const designPresets = {
    standard: { margin: 12, headerGap: 16, footerGap: 24, fontSize: 16, storeSize: 24, titleSize: 21 },
    compact: { margin: 8, headerGap: 8, footerGap: 12, fontSize: 14, storeSize: 21, titleSize: 18 },
    spacious: { margin: 20, headerGap: 28, footerGap: 36, fontSize: 18, storeSize: 28, titleSize: 24 },
  };
  const selectedPreset = presets => Object.entries(presets).find(([, values]) => Object.entries(values).every(([key, value]) => layout[key] === value))?.[0] || 'custom';
  const designChoice = () => Object.keys(layout.textStyles).length ? 'custom' : selectedPreset(designPresets);
  let customLayout;
  const setLayout = () => {
    // Retain legacy font identifiers and other stored layout fields when editing.
    const { englishFont, arabicFont, ...editable } = layout;
    d.a4Layout = { englishFont, arabicFont, ...d.a4Layout, ...editable };
  };
  const textGroupLabels = { store: 'textStyleStore', title: 'textStyleTitle', labels: 'textStyleLabels', values: 'textStyleValues', tableHeadings: 'textStyleTableHeadings', rows: 'textStyleRows', totals: 'textStyleTotals', header: 'textStyleHeader', footer: 'textStyleFooter' };
  const textDefaults = key => {
    const base = d.a4Layout ? layout.fontSize : 16;
    const accent = ['store', 'title', 'tableHeadings', 'totals'].includes(key);
    return {
      size: Math.round((key === 'store' ? (d.a4Layout ? layout.storeSize : base * 1.5) : key === 'title' ? (d.a4Layout ? layout.titleSize : base * 1.3) : key === 'totals' ? base * 1.15 : base) * 10) / 10,
      weight: (accent || key === 'labels') && layout.emphasis === 'headings' ? 700 : 400,
      color: safeColor(accent ? d.accentColor : '#000000', '#000000'), accent,
    };
  };
  const textStyleControls = () => invoiceTextGroups.map(key => {
    const style = layout.textStyles[key] || {};
    return `<div class="invoice-text-style" role="group" aria-labelledby="text-${key}-heading">
      <div class="invoice-style-part"><span id="text-${key}-heading">${t(textGroupLabels[key])}</span><span class="text-style-color-source" id="text-${key}-color-info" data-text-color-source="${key}"></span></div>
      <div><label class="form-label" for="text-${key}-size">${t('textStyleSize')}</label><input class="form-control form-control-sm" id="text-${key}-size" data-text-group="${key}" data-text-prop="size" type="number" min="8" max="48" step="1" placeholder="${esc(t('textStyleDefault'))}" value="${style.size || ''}"></div>
      <div><label class="form-label" for="text-${key}-weight">${t('textStyleWeight')}</label><select class="form-select form-select-sm" id="text-${key}-weight" data-text-group="${key}" data-text-prop="weight">${[['', 'textStyleDefault'], [400, 'textStyleRegular'], [500, 'textStyleMedium'], [700, 'textStyleBold']].map(([value, label]) => `<option value="${value}"${String(style.weight || '') === String(value) ? ' selected' : ''}>${t(label)}</option>`).join('')}</select></div>
      <div><div class="form-label" aria-hidden="true">${t('textStyleColor')}</div>${pickerHtml('textStyle_' + key, style.color || textDefaults(key).color, t(textGroupLabels[key]) + ': ' + t('textStyleColor'), { sourceId: `text-${key}-color`, textGroup: key, descriptionId: `text-${key}-color-info` })}</div>
    </div>`;
  }).join('');
  const layoutNumber = key => {
    const [min, max, label] = layoutRanges[key];
    return `<div><label class="form-label" for="a4-${key}">${t(label)}</label>
      <input class="form-control" id="a4-${key}" data-a4="${key}" type="number" required min="${min}" max="${max}" step="1" value="${layout[key]}"></div>`;
  };
  const layoutAlign = (key, label) => `<div><label class="form-label" for="a4-${key}">${t(label)}</label>
    <select class="form-select" id="a4-${key}" data-a4="${key}">${opt('start', t('alignStart'), layout[key])}${opt('center', t('alignCenter'), layout[key])}${opt('end', t('alignEnd'), layout[key])}</select></div>`;
  const fontSample = (key, family, prefix, dir) => `<div class="invoice-font-picker">
    <div class="small fw-semibold" dir="ltr">${family}</div>
    <div class="invoice-font-sample mt-1" data-font-sample="${key}" dir="${dir}" style="font-family:${prefix}-${layout[key]},sans-serif">${t(dir === 'rtl' ? 'invoiceArabicFontSample' : 'invoiceEnglishFontSample')}</div>
  </div>`;
  const numbering = { ...invoiceNumbering() };
  const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  $('#app').innerHTML = `
    ${topbar(t('settings'))}
    <div class="page settings-page">
      <div class="settings-toolbar">
      <div class="settings-tabs" role="tablist" aria-label="${esc(t('settings'))}">
        ${[['general', 'general'], ['invoice', 'settingsInvoice'], ['data', 'settingsData']].map(([key, label]) => `<button type="button" class="btn btn-outline-primary settings-tab" id="settings-tab-${key}" role="tab" aria-controls="settings-panel-${key}" aria-selected="false" tabindex="-1" data-settings-tab="${key}">${t(label)}</button>`).join('')}
      </div>
      <div class="settings-save-group"><span id="sf-save-status" class="small text-secondary" role="status" aria-live="polite"></span><button type="submit" form="sf" class="btn btn-brand settings-save-action" id="sf-save" title="${esc(t('settingsSaveHint'))}"><i class="bi bi-check-lg" aria-hidden="true"></i> ${t('save')}</button></div>
      </div>
      <form id="sf" novalidate>
        <section id="settings-panel-general" role="tabpanel" aria-labelledby="settings-tab-general" tabindex="0" hidden class="settings-general bg-white rounded shadow-sm p-3 p-md-4">
            <h5 class="mb-3">${t('general')}</h5>
            <fieldset class="mb-4">
              <legend class="h6">${t('topbarTheme')}</legend>
              <div class="form-label">${t('topbarColor')}</div>
              <div class="app-color-control">
                ${pickerHtml('topbarColor', d.topbarColor, t('topbarColor'))}
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
            <div class="mb-3"><label class="form-label">${t('lowStockAt')}</label>
              <input class="form-control" name="lowStock" inputmode="numeric" dir="ltr" value="${int(d.lowStock)}"></div>
        </section>
        <section id="settings-panel-invoice" role="tabpanel" aria-labelledby="settings-tab-invoice" tabindex="0" hidden>
          <div class="row g-4">
            <div class="col-lg-5">
              <div class="invoice-settings-controls bg-white rounded shadow-sm p-3 p-md-4">
            <section class="invoice-settings-section" aria-labelledby="invoice-design-heading">
              <h5 id="invoice-design-heading">${t('invoicePaperAndDesign')}</h5>
              <div class="mb-3"><label class="form-label" for="sf-paper">${t('paper')}</label>
                <select class="form-select" id="sf-paper" name="paper">${opt('a4', t('paperA4'), d.paper)}${opt('receipt', t('paperReceipt'), d.paper)}</select></div>
            </section>
            <fieldset id="sf-a4" class="invoice-a4-settings"${d.paper === 'receipt' ? ' hidden' : ''}>
              <legend class="visually-hidden">${t('a4Layout')}</legend>
              <section class="invoice-settings-section" aria-labelledby="invoice-layout-heading">
                <div class="mb-3">
                  <label class="form-label" id="invoice-layout-heading" for="sf-design">${t('invoiceDesignPreset')}</label>
                  <select class="form-select" id="sf-design" aria-describedby="sf-design-hint">
                    ${[['standard', 'invoiceStandard'], ['compact', 'invoiceCompact'], ['spacious', 'invoiceSpacious'], ['custom', 'invoiceDesignCustom']].map(([key, label]) => opt(key, t(label), designChoice())).join('')}
                  </select>
                  <p class="form-text" id="sf-design-hint">${t('invoiceDesignHint')}</p>
                </div>
                <div class="invoice-layout-fields mb-3">
                  ${['margin', 'headerGap', 'footerGap'].map(layoutNumber).join('')}
                  ${layoutAlign('headerAlign', 'a4HeaderAlign')}
                  ${layoutAlign('footerAlign', 'a4FooterAlign')}
                </div>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="sf-a4-reset">${t('a4Reset')}</button>
              </section>
              <section class="invoice-settings-section" aria-labelledby="invoice-typography-heading">
                <h5 id="invoice-typography-heading">${t('invoiceTypography')}</h5>
                <div class="invoice-layout-fields mb-3">${['fontSize', 'storeSize', 'titleSize'].map(layoutNumber).join('')}</div>
                <div class="invoice-font-samples mb-3">
                  ${fontSample('englishFont', 'IBM Plex Sans', 'InvoiceLatin', 'ltr')}
                  ${fontSample('arabicFont', 'IBM Plex Sans Arabic', 'InvoiceArabic', 'rtl')}
                </div>
                <h6>${t('textStyles')}</h6>
                <p class="form-text">${t('textStylesHint')}</p>
                <div id="sf-text-styles" class="invoice-text-styles">
                  <div class="invoice-style-head" aria-hidden="true"><span></span><span>${t('textStyleSize')}</span><span>${t('textStyleWeight')}</span><span>${t('textStyleColor')}</span></div>
                  ${textStyleControls()}
                </div>
                <button type="button" class="btn btn-outline-secondary btn-sm mt-2" id="sf-text-reset">${t('textStyleReset')}</button>
              </section>
            </fieldset>
            <section class="invoice-settings-section" aria-labelledby="invoice-branding-heading">
            <h5 id="invoice-branding-heading">${t('invoiceBranding')}</h5>
            <div class="mb-3"><label class="form-label">${t('storeName')}</label>
              <input class="form-control" name="storeName" maxlength="200" dir="auto" value="${esc(d.storeName)}"></div>

            <h6 class="mt-4 mb-3">${t('logo')}</h6>
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

            <div class="row g-3 mb-3">
              <div class="col-6"><label class="form-label">${t('accentColor')}</label>
                ${pickerHtml('accentColor', d.accentColor, t('accentColor'))}</div>
              <div class="col-6"><label class="form-label">${t('rowColor')}</label>
                ${pickerHtml('rowColor', d.rowColor, t('rowColor'))}</div>
            </div>
            </section>
            <section class="invoice-settings-section" aria-labelledby="invoice-content-heading">
            <h5 id="invoice-content-heading">${t('invoiceContent')}</h5>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showStoreName" id="sf-show"${d.showStoreName ? ' checked' : ''}>
              <label class="form-check-label" for="sf-show">${t('showStoreName')}</label></div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showPaid" id="sf-paid"${d.showPaid ? ' checked' : ''}>
              <label class="form-check-label" for="sf-paid">${t('showPaid')}</label></div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showDate" id="sf-date"${d.showDate !== false ? ' checked' : ''}>
              <label class="form-check-label" for="sf-date">${t('showDate')}</label></div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="showTime" id="sf-time"${d.showTime !== false ? ' checked' : ''}>
              <label class="form-check-label" for="sf-time">${t('showTime')}</label></div>
            <div class="mb-3"><label class="form-label">${t('invoiceTitle')}</label>
              <input class="form-control" name="invoiceTitle" maxlength="100" dir="auto" placeholder="${esc(t('invoiceTitlePh'))}" value="${esc(d.invoiceTitle)}"></div>
            <div class="mb-3"><label class="form-label">${t('header')}</label>
              <textarea class="form-control" name="header" rows="3" dir="auto" placeholder="${esc(t('headerPh'))}">${esc(d.header)}</textarea></div>
            <div class="mb-3"><label class="form-label">${t('footer')}</label>
              <textarea class="form-control" name="footer" rows="3" dir="auto" placeholder="${esc(t('footerPh'))}">${esc(d.footer)}</textarea></div>
            </section>
            <section class="invoice-settings-section" aria-labelledby="invoice-numbering-heading">
            <h5 id="invoice-numbering-heading">${t('invoiceNumbering')}</h5>
            <div class="mb-3">
              <label class="form-label" for="sf-next-number">${t('nextInvoiceNumber')} (${numbering.year})</label>
              <div class="input-group" dir="ltr"><span class="input-group-text">INV-HS-${numbering.year}-</span>
                <input class="form-control" id="sf-next-number" name="nextInvoiceNumber" inputmode="numeric" value="${numbering.nextNumber}"></div>
              <div class="form-text">${t('numberingHint')}</div>
            </div>
            </section>
              </div>
            </div>
            <div class="col-lg-7">
              <div class="settings-preview">
                <h5>${t('preview')}</h5>
                <div id="sf-preview"></div>
              </div>
            </div>
          </div>
        </section>
        <section id="settings-panel-data" role="tabpanel" aria-labelledby="settings-tab-data" tabindex="0" hidden class="settings-general bg-white rounded shadow-sm p-3 p-md-4">
          <h5>${t('settingsData')}</h5>
          <a class="btn btn-outline-secondary mt-3" href="#/backup"><i class="bi bi-shield-check"></i> ${t('backup')}</a>
            <div class="mt-4 small text-secondary">
              <div class="fw-semibold"><i class="bi bi-folder2-open"></i> ${t('dataFolder')}</div>
              <div dir="ltr" class="text-start text-break"><code>${esc(state.dataDir)}</code></div>
              <div>${t('dataNote')}</div>
            </div>
        </section>
      </form>
    </div>`;

  $('.topbar').classList.add('settings-topbar');
  const f = $('#sf');
  const showPaperControls = () => { $('#sf-a4').hidden = d.paper === 'receipt'; };
  const selectTab = (key, focus = false) => {
    if (!['general', 'invoice', 'data'].includes(key)) key = 'general';
    state.settingsTab = key;
    $$('[data-settings-tab]', f.parentElement).forEach(button => {
      const active = button.dataset.settingsTab === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      $(`#settings-panel-${button.dataset.settingsTab}`).hidden = !active;
      if (active && focus) button.focus();
    });
  };
  const revealControl = control => {
    const panel = control.closest('[role="tabpanel"]');
    if (panel) selectTab(panel.id.replace('settings-panel-', ''));
    control.focus();
  };
  const tabs = $$('[data-settings-tab]');
  tabs.forEach((button, index) => {
    button.onclick = () => selectTab(button.dataset.settingsTab);
    button.onkeydown = event => {
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else if (event.key === 'ArrowRight') next = (index + (lang() === 'ar' ? -1 : 1) + tabs.length) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + (lang() === 'ar' ? 1 : -1) + tabs.length) % tabs.length;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next].dataset.settingsTab, true); }
    };
  });
  selectTab(state.settingsTab);
  const sample = {
    code: nextInvoiceCode(), date: new Date().toISOString(),
    customerName: t('sampleCustomer'), customerPhone: '0000 000 0000', customerAddress: t('sampleAddress'),
    items: [
      { name: t('sampleProduct') + ' 1', price: 25000, qty: 2, total: 50000 },
      { name: t('sampleProduct') + ' 2', price: 7500, qty: 3, total: 22500 },
      { name: t('sampleProduct') + ' 3', price: 12000, qty: 1, total: 12000 },
    ],
    total: 84500, // 50,000 + 22,500 + 12,000
  };
  let colorPickers = {}, savedDraft;
  const draftSignature = () => JSON.stringify([d.logo || '', d.a4Layout ? a4Layout(d) : null, ...Array.from(f.elements).filter(control => control.matches('input, select, textarea') && control.type !== 'file' && control.id !== 'sf-design').map(control => [control.name || control.id, ['checkbox', 'radio'].includes(control.type) ? control.checked : control.value])]);
  const previewTarget = $('#sf-preview');
  const drawInvoice = frameUpdate(() => {
    if (previewTarget.isConnected) previewTarget.innerHTML = invoiceHtml(sample, d);
  });
  const preview = () => {
    drawInvoice();
    $('.topbar').style.cssText = topbarStyle(d);
    applyAccent(d);
    $$('[data-text-prop="color"]', f).forEach(control => {
      const key = control.dataset.textGroup, style = layout.textStyles[key] || {}, defaults = textDefaults(key);
      if (!style.color) control.value = defaults.color;
      $(`[data-text-color-source="${key}"]`, f).textContent = t(style.color ? 'textColorCustom' : defaults.accent ? 'textColorAccent' : 'textColorDefault');
      const size = $(`#text-${key}-size`, f);
      size.placeholder = String(defaults.size);
      size.title = `${t('textStyleDefault')}: ${defaults.size}px`;
      $(`#text-${key}-weight option[value=""]`, f).textContent = `${t(defaults.weight === 700 ? 'textStyleBold' : 'textStyleRegular')} (${t('textStyleDefault')})`;
    });
    Object.values(colorPickers).forEach(picker => picker.sync());
    const signature = draftSignature();
    if (savedDraft === undefined) savedDraft = signature;
    const unsaved = signature !== savedDraft || logoUploads > 0;
    $('#sf-save-status').textContent = t(unsaved ? 'settingsUnsaved' : 'settingsAllSaved');
    $('#sf-save-status').dataset.unsaved = String(unsaved);
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
    if (d.logoAlign !== f.logoAlign.value) {
      d.logoAlign = f.logoAlign.value;
      if (!d.a4Layout) {
        layout.headerAlign = a4Layout(d).headerAlign;
        $('#a4-headerAlign').value = layout.headerAlign;
      }
    }
    d.showStoreName = f.showStoreName.checked;
    d.invoiceTitle = f.invoiceTitle.value;
    d.header = f.header.value;
    d.footer = f.footer.value;
    d.paper = f.paper.value;
    showPaperControls();
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
  const syncLayout = (resetColors = false) => {
    $$('[data-a4]', f).forEach(control => {
      control.value = layout[control.dataset.a4];
    });
    $$('[data-text-group]', f).forEach(control => {
      const style = layout.textStyles[control.dataset.textGroup] || {};
      control.value = style[control.dataset.textProp] || (control.dataset.textProp === 'color' ? textDefaults(control.dataset.textGroup).color : '');
    });
    if (resetColors) invoiceTextGroups.forEach(key => colorPickers['textStyle_' + key]?.sync(true));
  };
  const editLayout = () => {
    setLayout();
    customLayout = undefined;
    $('#sf-design').value = 'custom';
    read();
  };
  $('#sf-design').onchange = event => {
    const choice = event.target.value;
    if (choice === 'custom') {
      if (customLayout) {
        if (customLayout.saved) d.a4Layout = customLayout.saved;
        else delete d.a4Layout;
        Object.assign(layout, a4Layout(d));
        customLayout = undefined;
        syncLayout(true);
      }
    } else {
      if (designChoice() === 'custom' || !customLayout) {
        customLayout = { saved: d.a4Layout ? JSON.parse(JSON.stringify(d.a4Layout)) : undefined };
      }
      Object.assign(layout, designPresets[choice], { textStyles: {} });
      setLayout();
      syncLayout(true);
    }
    read();
  };
  $$('[data-text-group]', f).forEach(control => {
    const update = () => {
      if (control.type === 'number' && control.value && !control.checkValidity()) return;
      const key = control.dataset.textGroup, prop = control.dataset.textProp;
      const style = { ...layout.textStyles[key] };
      if (!control.value) delete style[prop];
      else style[prop] = prop === 'color' ? control.value : Number(control.value);
      if (Object.keys(style).length) layout.textStyles[key] = style;
      else delete layout.textStyles[key];
      editLayout();
    };
    control.oninput = update;
    control.onchange = update;
  });
  $('#sf-text-reset').onclick = () => {
    layout.textStyles = {};
    syncLayout(true); editLayout();
  };
  $$('[data-a4]', f).forEach(control => {
    const update = () => {
      if (control.type === 'number' && (!control.value || !control.checkValidity())) return;
      layout[control.dataset.a4] = control.type === 'number' ? control.valueAsNumber : control.value;
      editLayout();
    };
    control.oninput = update;
    control.onchange = update;
  });
  $('#sf-a4-reset').onclick = () => {
    delete d.a4Layout;
    Object.assign(layout, a4Layout(d));
    customLayout = undefined;
    $('#sf-design').value = designChoice();
    syncLayout(true);
    read();
  };
  colorPickers = InventoryColorPicker.mount(f);
  $('#sf-topbar-reset').onclick = () => { f.topbarColor.value = '#714b67'; colorPickers.topbarColor.sync(true); read(); };
  $$('[data-header-color]').forEach(button => { button.onclick = () => { f.topbarColor.value = button.dataset.headerColor; colorPickers.topbarColor.sync(true); read(); }; });
  $('#sf-topbar-custom').onclick = () => {
    colorPickers.topbarColor.focus();
  };
  f.onsubmit = async e => {
    e.preventDefault();
    if (logoUploads || settingsSaving) { if (logoUploads) toast(t('uploadWait'), true); return; }
    const invalidColor = $$('.color-picker-hex[aria-invalid="true"]', f).find(control => f.paper.value !== 'receipt' || !control.closest('#sf-a4'));
    if (invalidColor) {
      revealControl(invalidColor);
      colorPickers[invalidColor.closest('[data-color-picker]').dataset.colorPicker].open();
      invalidColor.focus();
      return toast(t('err.badColor'), true);
    }
    read();
    const low = parseWhole(f.lowStock.value);
    const invalidLayout = $('#sf-a4 input[type="number"]:invalid');
    if (invalidLayout && d.paper !== 'receipt') {
      revealControl(invalidLayout); invalidLayout.reportValidity(); return;
    }
    if (isNaN(low) || low > 1e6) { revealControl(f.lowStock); return toast(t('err.badStock'), true); }
    const next = parseInvoiceNumber(f.nextInvoiceNumber.value);
    if (!next) { revealControl(f.nextInvoiceNumber); return toast(t('err.invoiceNumber'), true); }
    if (next < numbering.nextNumber) { revealControl(f.nextInvoiceNumber); return toast(t('err.invoiceNumberUsed'), true); }
    const button = $('#sf-save');
    settingsSaving = true;
    const settingsControls = Array.from(f.elements).map(control => [control, control.disabled]);
    settingsControls.forEach(([control]) => { control.disabled = true; });
    button.disabled = true;
    try {
      await api('PUT', '/api/settings', { ...d, expectedSettingsToken: savedSettingsToken,
        ...(next !== numbering.nextNumber ? { nextInvoiceNumber: next, invoiceYear: numbering.year } : {}) });
      leaveGuard = null;
      applyLang(); toast(t('saved')); route();
    } catch (err) { toast(err.message, true); }
    finally { settingsSaving = false; settingsControls.forEach(([control, disabled]) => { control.disabled = disabled; }); button.disabled = logoUploads > 0; }
  };
  $('#sf-logo').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    logoUploads++;
    const spinner = $('#sf-spin'), saveButton = $('#sf-save');
    saveButton.disabled = true;
    $('#sf-logo').disabled = true;
    $('#sf-logo-del').disabled = true;
    spinner.classList.remove('d-none');
    try { d.logo = await uploadImage(file, 600, 'image/png'); preview(); }
    catch (err) { toast(err.message, true); }
    logoUploads--;
    if (f.isConnected) {
      spinner.classList.toggle('d-none', logoUploads === 0);
      saveButton.disabled = logoUploads > 0 || settingsSaving;
      $('#sf-logo-del').disabled = logoUploads > 0 || settingsSaving;
      $('#sf-logo').disabled = logoUploads > 0 || settingsSaving;
    }
  };
  $('#sf-logo-del').onclick = () => { d.logo = ''; preview(); };

  leaveGuard = () => {
    if (settingsBusy()) { toast(t('uploadWait'), true); return false; }
    return (!dirtyForms.has(f) && JSON.stringify(d) === saved && parseInvoiceNumber(f.nextInvoiceNumber.value) === numbering.nextNumber) || confirm(t('unsaved'));
  };
  showPaperControls();
  preview();
  drawInvoice.flush();
}
