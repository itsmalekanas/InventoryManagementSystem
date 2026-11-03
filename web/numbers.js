'use strict';

// Accept whole numbers and correctly grouped thousands separators. Never
// remove signs, decimal points, letters or misplaced separators to make a value.
function parseWhole(value) {
  const digits = String(value ?? '').trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/٬/g, ',');
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(digits)) return NaN;
  const number = Number(digits.replace(/,/g, ''));
  return Number.isSafeInteger(number) ? number : NaN;
}

function parseInvoiceNumber(value) {
  const number = parseWhole(value);
  return number >= 1 && number <= 999999999 ? number : null;
}
