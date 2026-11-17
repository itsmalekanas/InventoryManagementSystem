'use strict';

/* ---------------- full backup and restore ---------------- */

let transferInProgress = false;
window.addEventListener('beforeunload', e => {
  const unsavedForm = $$('form').some(form => dirtyForms.has(form) && form.getClientRects().length > 0 && (!form.closest('.modal') || form.closest('.modal').classList.contains('show')));
  if (transferInProgress || settingsBusy() || unsavedForm || state.cart.length > 0 || state.pendingSale) { e.preventDefault(); e.returnValue = ''; }
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
