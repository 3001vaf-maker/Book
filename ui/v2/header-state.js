const menuHeaderState = new WeakMap();

function rootApp(root) {
  return root?.matches?.('[data-v2-app]')
    ? root
    : root?.closest?.('[data-v2-app]') || root?.querySelector?.('[data-v2-app]');
}

function captureHeader(header) {
  const title = header.querySelector('.v2-header__title');
  const cSlot = header.querySelector('.v2-header__slot--c');
  const dSlot = header.querySelector('.v2-header__slot--d');
  const aControl = header.querySelector('.v2-header__slot--a .v2-header__control');
  const dControl = dSlot?.querySelector('.v2-header__control');
  return {
    title,
    titleHtml: title?.innerHTML ?? '',
    titleAria: title?.getAttribute('aria-label'),
    cSlot,
    cHidden: Boolean(cSlot?.hidden),
    hadCClass: header.classList.contains('has-c'),
    gridTemplateColumns: header.style.gridTemplateColumns,
    dSlot,
    dGridColumn: dSlot?.style.gridColumn ?? '',
    aControl,
    aDisabled: Boolean(aControl?.disabled),
    dControl,
    dDisabled: Boolean(dControl?.disabled),
  };
}

function applyMenuHeader(header, state) {
  if (state.title) {
    state.title.textContent = 'Меню';
    if (state.title.matches('button')) state.title.setAttribute('aria-label', 'Меню');
  }
  if (state.cSlot) state.cSlot.hidden = true;
  header.classList.remove('has-c');
  if (state.aControl) state.aControl.disabled = true;
  if (state.dControl) state.dControl.disabled = false;

  const hasD = Boolean(state.dSlot);
  header.style.gridTemplateColumns = hasD
    ? '52px minmax(0,1fr) 46px'
    : '52px minmax(0,1fr)';
  if (state.dSlot) state.dSlot.style.gridColumn = '3';
}

function restoreHeader(header, state) {
  if (state.title?.isConnected) {
    state.title.innerHTML = state.titleHtml;
    if (state.titleAria == null) state.title.removeAttribute('aria-label');
    else state.title.setAttribute('aria-label', state.titleAria);
  }
  if (state.cSlot?.isConnected) state.cSlot.hidden = state.cHidden;
  header.classList.toggle('has-c', state.hadCClass);
  header.style.gridTemplateColumns = state.gridTemplateColumns;
  if (state.dSlot?.isConnected) state.dSlot.style.gridColumn = state.dGridColumn;
  if (state.aControl?.isConnected) state.aControl.disabled = state.aDisabled;
  if (state.dControl?.isConnected) state.dControl.disabled = state.dDisabled;
}

export function setV2MenuHeaderState(root, open) {
  const app = rootApp(root);
  const header = app?.querySelector?.(':scope > [data-v2-header]');
  if (!app || !header) return Boolean(open);

  if (open) {
    if (!menuHeaderState.has(header)) menuHeaderState.set(header, captureHeader(header));
    applyMenuHeader(header, menuHeaderState.get(header));
    header.dataset.v2MenuHeader = 'true';
    return true;
  }

  const state = menuHeaderState.get(header);
  if (state) restoreHeader(header, state);
  menuHeaderState.delete(header);
  delete header.dataset.v2MenuHeader;
  return false;
}
