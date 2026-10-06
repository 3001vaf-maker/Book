const Z_DISMISS_STYLE = [
  'box-sizing:border-box',
  'display:grid',
  'place-items:center',
  'width:20px',
  'min-width:20px',
  'max-width:20px',
  'height:20px',
  'min-height:20px',
  'max-height:20px',
  'margin:0',
  'padding:0',
  'border:0',
  'border-radius:0',
  'background:transparent',
  'box-shadow:none',
  'color:rgba(17,17,17,.34)',
  'font:inherit',
  'line-height:1',
  'cursor:pointer',
  'touch-action:manipulation',
].join(';');

export function v2ZDismissAffordance() {
  return `<button type="button" data-v2-z-dismiss aria-label="Смахнуть экран вправо" style="${Z_DISMISS_STYLE}"><svg aria-hidden="true" viewBox="0 0 20 20" width="12" height="12" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
}

export function bindV2ZDismissAffordance(surface, { onDismiss = null, isEnabled = null } = {}) {
  const control = surface?.querySelector?.('[data-v2-z-header] > [data-v2-z-dismiss]');
  if (!control || typeof onDismiss !== 'function') return () => {};
  const click = (event) => {
    if (typeof isEnabled === 'function' && !isEnabled()) return;
    event.preventDefault();
    event.stopPropagation();
    onDismiss();
  };
  control.addEventListener('click', click);
  return () => control.removeEventListener('click', click);
}
