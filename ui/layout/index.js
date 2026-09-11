const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[char]));

/**
 * Canonical neutral two-column layout.
 * It owns only geometry: two equal columns on one visual axis.
 * The content of each column is supplied by the caller and may be any shared UI.
 */
export function twoColumnLayout(left = '', right = '', { ariaLabel = '' } = {}) {
  const aria = ariaLabel ? ` role="group" aria-label="${esc(ariaLabel)}"` : '';
  return `<div class="two-column-layout"${aria}><div class="two-column-layout__column">${left}</div><div class="two-column-layout__column">${right}</div></div>`;
}
