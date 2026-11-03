'use strict';

const InventoryColorPicker = (() => {
  const clamp = n => Math.max(0, Math.min(1, n));
  function toHSV(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), delta = max - Math.min(r, g, b);
    const hue = !delta ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return { h: hue * 60, s: max ? delta / max : 0, v: max };
  }
  function toHex({ h, s, v }) {
    const hue = ((h % 360) + 360) % 360 / 60, c = v * s, x = c * (1 - Math.abs(hue % 2 - 1)), m = v - c;
    const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hue)];
    return '#' + rgb.map(n => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  function normalize(value) {
    const hex = value.trim().replace(/^#/, '');
    if (/^[\da-f]{6}$/i.test(hex)) return '#' + hex.toLowerCase();
    if (/^[\da-f]{3}$/i.test(hex)) return '#' + hex.split('').map(c => c + c).join('').toLowerCase();
    return null;
  }
  function html(name, color, label, labels) {
    // Callers provide fixed field names, validated hex colors and escaped labels.
    const id = 'picker-' + name;
    return `<div class="color-picker" data-color-picker="${name}">
      <input type="hidden" id="${name === 'topbarColor' ? 'sf-topbar-color' : 'picker-source-' + name}" name="${name}" value="${color}">
      <button type="button" class="color-picker-trigger" aria-expanded="false" aria-controls="${id}" aria-label="${label}">
        <span class="color-picker-swatch" aria-hidden="true"></span><span class="color-picker-value" dir="ltr"></span><i class="bi bi-chevron-down" aria-hidden="true"></i>
      </button>
      <div class="color-picker-panel" id="${id}" hidden>
        <div class="color-picker-field" aria-hidden="true"><span class="color-picker-marker"></span></div>
        <label class="color-picker-label">${labels.hue}<input class="color-picker-hue" type="range" min="0" max="359" step="1" dir="ltr"></label>
        <div class="color-picker-sliders">
          <label class="color-picker-label">${labels.saturation}<input class="color-picker-saturation form-range" type="range" min="0" max="100" step="1" dir="ltr"></label>
          <label class="color-picker-label">${labels.brightness}<input class="color-picker-brightness form-range" type="range" min="0" max="100" step="1" dir="ltr"></label>
        </div>
        <label class="color-picker-label">${labels.hex}<input class="form-control color-picker-hex" type="text" dir="ltr" maxlength="7" spellcheck="false" autocomplete="off" aria-invalid="false"></label>
      </div>
    </div>`;
  }
  function mount(form) {
    const pickers = {};
    form.querySelectorAll('[data-color-picker]').forEach(root => {
      const source = root.querySelector('input[type=hidden]'), trigger = root.querySelector('.color-picker-trigger');
      const panel = root.querySelector('.color-picker-panel'), field = root.querySelector('.color-picker-field');
      const hue = root.querySelector('.color-picker-hue'), saturation = root.querySelector('.color-picker-saturation');
      const brightness = root.querySelector('.color-picker-brightness'), hex = root.querySelector('.color-picker-hex');
      let hsv, currentHex;
      const paint = () => {
        currentHex = toHex(hsv);
        source.value = currentHex;
        root.querySelector('.color-picker-swatch').style.background = currentHex;
        root.querySelector('.color-picker-value').textContent = currentHex.toUpperCase();
        field.style.backgroundColor = toHex({ h: hsv.h, s: 1, v: 1 });
        const marker = root.querySelector('.color-picker-marker');
        marker.style.left = hsv.s * 100 + '%'; marker.style.top = (1 - hsv.v) * 100 + '%';
        hue.value = Math.round(hsv.h); saturation.value = Math.round(hsv.s * 100); brightness.value = Math.round(hsv.v * 100);
        hex.value = currentHex.toUpperCase(); hex.setAttribute('aria-invalid', 'false'); hex.classList.remove('is-invalid');
      };
      const sync = (force = false) => { const value = normalize(source.value); if (value && (force || value !== currentHex)) { hsv = toHSV(value); paint(); } };
      const emit = () => { paint(); source.dispatchEvent(new Event('input', { bubbles: true })); };
      const open = () => { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); };
      trigger.onclick = () => { panel.hidden = !panel.hidden; trigger.setAttribute('aria-expanded', String(!panel.hidden)); };
      root.onkeydown = event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); } };
      hue.oninput = () => { hsv.h = Number(hue.value); emit(); };
      saturation.oninput = () => { hsv.s = Number(saturation.value) / 100; emit(); };
      brightness.oninput = () => { hsv.v = Number(brightness.value) / 100; emit(); };
      hex.oninput = () => {
        const value = normalize(hex.value);
        hex.setAttribute('aria-invalid', String(!value)); hex.classList.toggle('is-invalid', !value);
        if (value) { hsv = toHSV(value); currentHex = value; source.value = value;
          // Keep the caret in place while editing the hex field.
          const text = hex.value, start = hex.selectionStart; emit(); hex.value = text; hex.setSelectionRange(start, start);
        }
      };
      const choose = event => {
        const rect = field.getBoundingClientRect();
        hsv.s = clamp((event.clientX - rect.left) / rect.width); hsv.v = 1 - clamp((event.clientY - rect.top) / rect.height); emit();
      };
      field.onpointerdown = event => { if (event.button !== 0) return; event.preventDefault(); field.setPointerCapture(event.pointerId); choose(event); };
      field.onpointermove = event => { if (field.hasPointerCapture(event.pointerId)) choose(event); };
      field.onpointerup = event => { if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId); };
      sync();
      pickers[root.dataset.colorPicker] = { sync, open, focus: () => { open(); hue.focus(); } };
    });
    return pickers;
  }
  return { html, mount, toHSV, toHex, normalize };
})();
if (typeof module !== 'undefined') module.exports = InventoryColorPicker;
