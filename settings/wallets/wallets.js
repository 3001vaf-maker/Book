import { actionBlock, button, details, emptyState, entityCard, escapeHtml, field, iconButton, initPhotoField, listEntries, listEntry, mountModal, modal, openNotice, page, pageHeader, photoField, shortDateTime } from '../../ui/ui.js';
import { cancelFinanceOperation, getLedgerEntries } from '../../core/finance/index.js';
import { deleteWallet as deleteWalletData, getWalletBalance, getWalletHistory, getWallets, saveWallet as saveWalletData, updateWallet } from './data.js';

const formatMoney = (value) => `${(Number(value) || 0).toLocaleString('ru-RU')} ₽`;

function operationMoment(payment) {
  const raw = payment?.refundedAt || payment?.paidAt || payment?.createdAt || '';
  const fallback = `${payment?.date || ''} ${payment?.time || ''}`.trim();
  return shortDateTime(raw, fallback);
}

function recordedMoment(payment) {
  return payment?.recordedAt ? shortDateTime(payment.recordedAt, '') : '';
}

function operationName(payment) {
  const direction = String(payment?.direction || '');
  const economicType = String(payment?.economicType || '');
  let title = direction === 'OUT' ? 'Расход' : 'Доход';
  if (economicType === 'SERVICE_REVENUE') title = 'Оплата услуги';
  else if (economicType === 'SERVICE_REFUND') title = 'Возврат услуги';
  else if (economicType === 'TIPS_REFUND') title = 'Возврат чаевых';
  else if (economicType === 'TIPS') title = 'Чаевые';
  else if (economicType === 'REVERSAL') title = 'Отмена операции';
  else if (economicType === 'LOAN_RECEIVED') title = 'Получен займ';
  else if (economicType === 'LOAN_REPAYMENT') title = 'Возврат займа';
  else if (economicType === 'INVESTMENT_RECEIVED') title = 'Получена инвестиция';
  else if (economicType === 'INVESTMENT_RETURN') title = 'Возврат инвестиций';
  else if (economicType === 'TRANSFER') title = direction === 'OUT' ? 'Перевод · списание' : 'Перевод · зачисление';
  else if (payment?.articleName) title = payment.articleName;
  return payment?.operationStatus === 'cancelled' ? `${title} · Отменена` : title;
}

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function renderList(root, navigateBack) {
  const items = getWallets();
  root.innerHTML = `<div class="entity-page-header">${pageHeader('Касса')}<div class="page-header-action">${iconButton('+', { className: 'icon-button--primary', data: 'data-add-wallet', aria: 'Добавить кошелёк' })}</div></div>${items.length ? listEntries(items.map(renderRow)) : emptyState('Кошельков пока нет', 'Добавьте первый кошелёк кнопкой «+».')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-back-wallets' }))}`;
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

function renderPaymentRow(payment, { interactive = true } = {}) {
  const amount = Number(payment?.total) || 0;
  const canOpen = interactive && Boolean(payment?.operationId);
  return listEntry({
    title: operationName(payment),
    subtitle: [payment?.sourceDetails || '', payment?.lineName || '', operationMoment(payment)].filter(Boolean).join(' · '),
    rightTop: formatMoney(amount),
    initial: '₽',
    interactive: canOpen,
    data: canOpen ? `data-wallet-operation="${escapeHtml(payment.operationId)}"` : '',
    aria: canOpen ? `Открыть финансовую операцию ${operationName(payment)}` : '',
  });
}

function openWalletOperation(root, operationId, wallet, navigateBack) {
  const id = String(operationId || '');
  const entries = getLedgerEntries().filter((item) => String(item?.operationId || '') === id);
  if (!entries.length) return;
  const first = entries[0];
  const canCancel = first?.operationKind !== 'cancel' && first?.operationStatus !== 'cancelled';
  const person = [first?.person?.name, first?.person?.surname].filter(Boolean).join(' ').trim();
  const wallets = [...new Set(entries.map((item) => item?.walletName || item?.walletId || '').filter(Boolean))].join(' + ');
  const articles = [...new Set(entries.map((item) => String(item?.articleName || '')).filter(Boolean))].join(', ');
  const sourceDetails = [...new Set(entries.map((item) => String(item?.sourceDetails || '')).filter(Boolean))].join(', ');
  const context = details([
    { label: 'Фактическая дата и время', value: operationMoment(first) || '—' },
    { label: 'Внесено в Book', value: recordedMoment(first) || '—' },
    person ? { label: 'Клиент', value: person } : null,
    sourceDetails ? { label: 'За что', value: sourceDetails } : null,
    first?.workplace ? { label: 'Рабочее место', value: first.workplace } : null,
    wallets ? { label: 'Кошелёк', value: wallets } : null,
    articles ? { label: 'Статья', value: articles } : null,
    first?.counterparty ? { label: 'Контрагент', value: first.counterparty } : null,
    first?.note ? { label: 'Комментарий', value: first.note } : null,
    { label: 'Статус', value: first?.operationStatus === 'cancelled' ? 'Отменена' : 'Активна' },
  ]);
  const rows = listEntries(entries.map((item) => renderPaymentRow(item, { interactive: false })));
  const cancel = canCancel
    ? `<div class="compact-form">
        ${field({ label: 'Фактическая дата и время отмены', name: 'walletCancelOccurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
        <p>Ошибочный ввод останется в финансовой истории, а его влияние на кошельки и отчёты будет отменено обратной операцией.</p>
        ${button('Отменить ошибочную операцию', { variant: 'danger', data: 'data-wallet-operation-cancel' })}
      </div>`
    : '';
  const m = mountModal(root, modal(`<div class="modal-title"><h2>${operationName(first)}</h2></div>${context}${rows}${cancel}`, { variant: 'medium' }));
  if (!m || !canCancel) return;
  m.querySelector('[data-wallet-operation-cancel]')?.addEventListener('click', async () => {
    const input = m.querySelector('input[name="walletCancelOccurredAt"]');
    if (!input?.value) return;
    try {
      const cancelled = await cancelFinanceOperation(id, {
        reason: 'incorrect-entry',
        occurredAt: new Date(input.value),
      });
      if (!cancelled) return;
      m.remove();
      renderCard(root, wallet.id, navigateBack);
    } catch (error) {
      openNotice({ message: String(error?.message || 'Не удалось отменить операцию') });
    }
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
  root.querySelectorAll('[data-wallet-operation]').forEach((element) => {
    element.addEventListener('click', () => openWalletOperation(root, element.dataset.walletOperation, wallet, navigateBack));
  });
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
