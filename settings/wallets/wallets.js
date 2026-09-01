import { button, emptyState, entityCard, escapeHtml, iconButton, initPhotoField, mountModal, modal, pageHeader, photoField } from '../../ui/ui.js';

const KEY = 'book.wallets';
const SYSTEM_WALLETS = [
  { id: 'cash', name: 'Наличные', photo: '', system: true },
  { id: 'cashless', name: 'Безналичные', photo: '', system: true },
];

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function list() {
  const stored = read(KEY, null);
  if (!Array.isArray(stored)) {
    write(KEY, SYSTEM_WALLETS);
    return [...SYSTEM_WALLETS];
  }
  return stored.filter((wallet) => !wallet.deletedAt);
}

function renderList(root) {
  const items = list();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Кошелёк')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-wallet', aria: 'Добавить кошелёк' })}</div></div>${items.length ? `<div class="entity-list">${items.map(renderRow).join('')}</div>` : emptyState('Кошельков пока нет', 'Добавьте первый кошелёк кнопкой «+».')}`;
  root.querySelector('[data-add-wallet]')?.addEventListener('click', () => openForm(root));
  root.querySelectorAll('[data-wallet]').forEach((element) => element.addEventListener('click', () => renderCard(root, element.dataset.wallet)));
}

function renderRow(wallet) {
  return entityCard({
    id: wallet.id,
    title: wallet.name,
    image: wallet.photo || '',
    initial: (wallet.name || '?').slice(0, 1).toUpperCase(),
    interactive: true,
    data: `data-wallet="${escapeHtml(wallet.id)}"`,
    className: 'entity-card--compact entity-card--wallet',
  });
}

function openForm(root, existing = null) {
  const wallet = existing || { photo: '', name: '' };
  const html = `<form class="compact-form" data-wallet-form><div class="modal-title"><h2>${existing ? 'Изменить кошелёк' : 'Новый кошелёк'}</h2></div>${photoField({ name: 'walletPhoto', value: wallet.photo || '' })}<label class="field"><span>Название кошелька *</span><input name="walletName" required value="${escapeHtml(wallet.name || '')}" placeholder="Название кошелька"></label>${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { title: existing ? 'Изменить кошелёк' : 'Новый кошелёк' }));
  initPhotoField(m);
  m.querySelector('[data-wallet-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveWallet(root, m, existing);
  });
}

function saveWallet(root, modalRoot, existing) {
  const form = modalRoot.querySelector('[data-wallet-form]');
  const data = new FormData(form);
  const name = String(data.get('walletName') || '').trim();
  if (!name) return;
  const item = {
    id: existing?.id || crypto.randomUUID(),
    name,
    photo: String(data.get('walletPhoto') || ''),
    system: Boolean(existing?.system),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const items = list();
  write(KEY, existing ? items.map((wallet) => wallet.id === existing.id ? item : wallet) : [...items, item]);
  modalRoot.remove();
  renderList(root);
}

function renderCard(root, id) {
  const wallet = list().find((item) => item.id === id);
  if (!wallet) return renderList(root);
  root.innerHTML = `${pageHeader(wallet.name)}${entityCard({
    image: wallet.photo || '',
    initial: (wallet.name || '?').slice(0, 1).toUpperCase(),
    className: 'entity-card--hero entity-card--wallet',
    top: `<strong class="entity-card__wallet-name">${escapeHtml(wallet.name)}</strong>`,
  })}<div class="profile-actions">${button('Работа с кошельком', { data: 'data-wallet-work' })}${button('Назад', { className: 'ui-button--secondary', data: 'data-back-wallets' })}</div>`;
  root.querySelector('[data-wallet-work]')?.addEventListener('click', () => openPhotoForm(root, wallet));
  root.querySelector('[data-back-wallets]')?.addEventListener('click', () => renderList(root));
}

function openPhotoForm(root, wallet) {
  const html = `<form class="compact-form" data-wallet-photo-form><div class="modal-title"><h2>Работа с кошельком</h2></div>${photoField({ name: 'walletPhoto', value: wallet.photo || '' })}${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { title: 'Работа с кошельком' }));
  initPhotoField(m);
  m.querySelector('[data-wallet-photo-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(m.querySelector('[data-wallet-photo-form]'));
    const items = list();
    const updated = items.map((item) => item.id === wallet.id ? { ...item, photo: String(data.get('walletPhoto') || ''), updatedAt: new Date().toISOString() } : item);
    write(KEY, updated);
    m.remove();
    renderCard(root, wallet.id);
  });
}

export function renderWallets(root) {
  renderList(root);
}
