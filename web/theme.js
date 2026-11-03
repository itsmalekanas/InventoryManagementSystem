'use strict';

// Apply the cached choice before styles load. The saved app setting takes
// precedence when the database arrives; storage may be blocked in private mode.
try {
  document.documentElement.dataset.bsTheme = localStorage.getItem('inventory-theme') === 'dark' ? 'dark' : 'light';
} catch (err) {
  document.documentElement.dataset.bsTheme = 'light';
}
