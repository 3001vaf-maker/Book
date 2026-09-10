import { actionBlock, button, emptyState, entityCard, escapeHtml, field, iconButton, initPhotoField, listEntries, listEntry, mountModal, modal, page, pageHeader, photoField, shortDateTime } from '../../ui/ui.js';
import { deleteWallet as deleteWalletData, getWalletBalance, getWalletHistory, getWallets, saveWallet as saveWalletData, updateWallet } from './data.js';

const formatMoney = (value) => `${(Number(value) || 0).toLocaleString('ru-RU')} ₽`;

function operationMoment(payment) {
  const raw = payment?.refundedAt || payment?.paidAt || payment?.createdAt || '';
  const fallback = `${payment?.date || ''} ${payment?.time || ''}`.trim();
  return shortDateTime(raw, fallback);
}

function renderList(root, navigateBack) {
  const items = getWallets();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Кошелёк')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-wallet', aria: 'Добавить кошелёк' })}</div></div>${items.length ? listEntries(items.map(renderRow)) : emptyState('Кошельков пока нет', 'Добавьте первый кошелёк кнопкой «+».')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-back-wallets' }))}`;
  root.querySelector('[data-add-wallet]')?.addEventListener('click', () => openForm(root, null, navigateBack));
  root.querySelectorAll('[data-wallet]').forEach((element) => element.addEventListener('click', () => renderCard(root, element.dataset.wallet, navigateBack)));
  root.querySelector('[data-back-wallets]')?.addEventListener('click', navigateBack);
}

function renderRow(wallet) {
  const total = getWalletBalance(wallet.id);
  return listEntry({
    title: wallet.name,
    subtitle: '',
    rightTop: formatMoney(total),
    image: wallet.photo || '',
    initial: (wallet.name || '?').slice(0, 1).toUpperCase(),
    interactive: true,
    data: `data-wallet="${escapeHtml(wallet.id)}"`,
    aria: `Открыть кошелёк ${wallet.name}, ${formatMoney(total)}`,
  });
}

function renderPaymentRow(payment) {
  const isRefund = payment?.ledgerType === 'refund' || payment?.expenseType === 'refund';
  return listEntry({
    title: isRefund ? 'Возврат' : 'Оплата',
    subtitle: operationMoment(payment),
    rightTop: formatMoney(payment?.total),
    initial: '₽',
    interactive: false,
  });
}

function openForm(root, existing = null, navigateBack) {
  const wallet = existing || { photo: '', name: '' };
  const html = `<form class="compact-form" data-wallet-form><div class="modal-title"><h2>${existing ? 'Изменить кошелёк' : 'Новый кошелёк'}</h2></div>${photoField({ name: 'walletPhoto', value: wallet.photo || '' })}${field({ label: 'Название кошелька', name: 'walletName', value: wallet.name || '', placeholder: 'Название кошелька', required: true })}${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { title: existing ? 'Изменить кошелёк' : 'Новый кошелёк' }));
  initPhotoField(m);
  m.querySelector('[data-wallet-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveWallet(root, m, existing, navigateBack);
  });
}

function saveWallet(root, modalRoot, existing, navigateBack) {
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
  saveWalletData(item);
  modalRoot.remove();
  renderList(root, navigateBack);
}

function renderCard(root, id, navigateBack) {
  const wallet = getWallets().find((item) => item.id === id);
  if (!wallet) return renderList(root, navigateBack);
  const payments = getWalletHistory(wallet.id);
  const card=entityCard({
    title:wallet.name||'',
    subtitle:'',
    image:wallet.photo||'',
    initial:(wallet.name||'?').slice(0,1).toUpperCase(),
    className:'entity-card--hero'
  });
  const paymentList = payments.length ? listEntries(payments.map(renderPaymentRow)) : emptyState('Оплат пока нет', 'После оплаты через этот кошелёк операции появятся здесь.');
  const deleteButton=wallet.system?'':button('Удалить',{variant:'danger',data:'data-delete-wallet-card'});
  root.innerHTML=page([card,paymentList,actionBlock(`${button('Работа с кошельком',{data:'data-wallet-work'})}${button('Назад',{className:'ui-button--secondary',data:'data-back-wallet-card'})}${deleteButton}`)]);
  root.querySelector('[data-wallet-work]')?.addEventListener('click', () => openPhotoForm(root, wallet, navigateBack));
  root.querySelector('[data-back-wallet-card]')?.addEventListener('click', () => renderList(root, navigateBack));
  root.querySelector('[data-delete-wallet-card]')?.addEventListener('click', () => confirmDeleteWallet(root, wallet, navigateBack));
}

function confirmDeleteWallet(root, wallet, navigateBack) {
  if (wallet.system) return;
  const html=`<div class="modal-title"><h2>Удалить кошелёк?</h2><p>${escapeHtml(wallet.name)} будет удалён.</p></div><div class="modal-actions">${button('Удалить',{variant:'danger',data:'data-confirm-delete-wallet'})}${button('Отмена',{className:'ui-button--secondary',data:'data-cancel-delete-wallet'})}</div>`;
  const m=mountModal(root,modal(html,{variant:'compact'}));
  if(!m)return;
  m.querySelector('[data-cancel-delete-wallet]')?.addEventListener('click',()=>m.remove());
  m.querySelector('[data-confirm-delete-wallet]')?.addEventListener('click',()=>{
    if(!deleteWalletData(wallet.id))return;
    m.remove();
    renderList(root,navigateBack);
  });
}

function openPhotoForm(root, wallet, navigateBack) {
  const html = `<form class="compact-form" data-wallet-photo-form><div class="modal-title"><h2>Работа с кошельком</h2></div>${photoField({ name: 'walletPhoto', value: wallet.photo || '' })}${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { title: 'Работа с кошельком' }));
  initPhotoField(m);
  m.querySelector('[data-wallet-photo-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(m.querySelector('[data-wallet-photo-form]'));
    updateWallet(wallet.id, { photo: String(data.get('walletPhoto') || '') });
    m.remove();
    renderCard(root, wallet.id, navigateBack);
  });
}

export function renderWallets(root, navigateBack = () => {}) {
  renderList(root, navigateBack);
}

export { renderWallets as render };