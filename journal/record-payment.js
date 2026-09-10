import { button, escapeHtml, initPaymentForm, initPaymentMethods, modal, mountModal, paymentForm, paymentMethods, select } from '../ui/ui.js';
import { completePayment, completeSplitPayment, createPaymentDraft, getCompletedPaymentForSource, getRefundsForPayment, paymentTotal, refundPayment } from '../core/payment.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { getWallets } from '../settings/wallets/data.js';
import { getRecords, updateRecord } from './record-data.js';

const money = (value) => `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₽`;

function paymentEntryContent(record) {
  const completed = getCompletedPaymentForSource('record', record?.id);
  if (completed) return `<button type="button" class="modal-bottom-action modal-bottom-action--paid" data-record-payment-paid aria-label="Открыть оплату ${completed.total} рублей"><strong>Оплачено</strong><strong>${money(completed.total)}</strong></button>`;
  const total = paymentTotal(record?.procedures || []);
  return `<button type="button" class="modal-bottom-action" data-record-payment-open aria-label="Открыть оплату, к оплате ${total} рублей"><span>К оплате</span><strong>${money(total)}</strong></button>`;
}

function workplaceName(id) {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(id || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function recordClient(record) {
  const source = record?.client || {};
  const people = getAllClients();
  const current = people.find((item) => String(item?.key ?? '') === String(source?.key ?? ''))
    || people.find((item) => String(item?.id ?? '') === String(source?.id ?? ''))
    || source;
  const display = clientDisplay(current);
  return { uei: display.uei || '', name: display.name || '' };
}

function paymentFromRecord(record) {
  return createPaymentDraft({
    source: { type: 'record', id: record?.id || '' },
    workplace: workplaceName(record?.workplaceId),
    client: recordClient(record),
    items: record?.procedures || [],
  });
}

function paidProcedures(record, payment) {
  const items = new Map((payment?.items || []).map((item) => [String(item?.sourceId || ''), item]));
  return (record?.procedures || []).map((procedure) => {
    const item = items.get(String(procedure?.id || ''));
    if (!item) return { ...procedure };
    const price = Number(item.price || 0);
    const discount = Math.max(0, Math.min(price, Number(item.discountMoney || 0)));
    return { ...procedure, cost: Math.max(0, price - discount) };
  });
}

function paymentAllocations(payment) {
  if (Array.isArray(payment?.allocations) && payment.allocations.length) return payment.allocations.map((item) => ({ ...item }));
  if (payment?.walletId) return [{ walletId: payment.walletId, walletName: payment.walletName || '', amount: Number(payment.total || 0) }];
  return [];
}

function paymentDateTime(payment) {
  const value = payment?.paidAt || payment?.createdAt;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('ru-RU')} в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function paymentFactMarkup(payment) {
  const when = paymentDateTime(payment);
  return `<div class="entity-details">
    ${when ? `<div><span>Оплачено</span><strong>${escapeHtml(when)}</strong></div>` : ''}
    <div><span>Сумма</span><strong>${escapeHtml(money(payment?.total))}</strong></div>
    ${allocationMarkup(payment)}
  </div>`;
}

function openPaymentMethodsModal(payment, values, paymentModal, replacesPaymentId = '', previousPayment = null) {
  const initialAllocations = previousPayment ? paymentAllocations(previousPayment) : [];
  const initialMode = initialAllocations.length > 1 ? 'split' : 'single';
  const content = `<div class="modal-title"><h2>${replacesPaymentId ? 'Редактировать оплату' : 'Способ оплаты'}</h2></div>${replacesPaymentId && previousPayment ? paymentFactMarkup(previousPayment) : ''}${paymentMethods({ wallets: getWallets(), total: values.total, initialMode, initialAllocations })}`;
  const methodsModal = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!methodsModal) return;
  const finish = (completed) => {
    if (!completed) return;
    if (completed?.source?.type === 'record' && completed?.source?.id) {
      const currentRecord = getRecords().find((item) => String(item?.id || '') === String(completed.source.id));
      updateRecord(completed.source.id, {
        attendance: 'arrived',
        ...(currentRecord ? { procedures: paidProcedures(currentRecord, completed) } : {}),
      });
    }
    methodsModal.remove();
    paymentModal?.remove();
  };
  initPaymentMethods(methodsModal.querySelector('[data-payment-methods]'), {
    onWallet: (wallet) => finish(replacesPaymentId
      ? completeSplitPayment(payment, { allocations: [{ walletId: wallet.id, walletName: wallet.name, amount: values.total }], items: values.items, total: values.total, replacesPaymentId })
      : completePayment(payment, { walletId: wallet.id, walletName: wallet.name, items: values.items, total: values.total })),
    onSplit: (allocations) => finish(completeSplitPayment(payment, { allocations, items: values.items, total: values.total, replacesPaymentId })),
  });
}

function openPaymentModal(record) {
  if (getCompletedPaymentForSource('record', record?.id)) return;
  const current = getRecords().find((item) => String(item?.id || '') === String(record?.id || '')) || record;
  const payment = paymentFromRecord(current);
  const content = `<div class="modal-title"><h2>Оплата</h2></div>${paymentForm({
    workplace: payment.workplace,
    date: payment.date,
    time: payment.time,
    client: payment.client || {},
    procedures: payment.items.map((item) => ({ id: item.sourceId, name: item.name, cost: item.price })),
    total: payment.total,
  })}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  initPaymentForm(m.querySelector('[data-payment-ui]'), { onPay: (values) => openPaymentMethodsModal(payment, values, m) });
}

function openPaymentEditor(record, previousPayment) {
  if (!previousPayment?.id) return;
  const current = getRecords().find((item) => String(item?.id || '') === String(record?.id || '')) || record;
  const draft = paymentFromRecord(current);
  const items = Array.isArray(previousPayment.items) ? previousPayment.items.map((item) => ({ ...item })) : [];
  const values = { total: Number(previousPayment.total || 0), items };
  openPaymentMethodsModal(draft, values, null, previousPayment.id, previousPayment);
}

function allocationMarkup(payment) {
  const allocations = paymentAllocations(payment);
  return allocations.map((item) => `<div><span>${escapeHtml(item.walletName || 'Кошелёк')}</span><strong>${escapeHtml(money(item.amount))}</strong></div>`).join('');
}

function openRefundModal(payment) {
  const refunds = getRefundsForPayment(payment.id);
  const refunded = refunds.reduce((sum, item) => sum + Number(item?.total || 0), 0);
  const remaining = Math.max(0, Number(payment.total || 0) - refunded);
  if (!remaining) {
    mountModal(document.body, modal(`<div class="modal-title"><h2>Возврат выполнен</h2><p>По этой оплате возвращена вся сумма.</p></div>${paymentFactMarkup(payment)}`, { variant: 'compact', surface: 'app' }));
    return;
  }
  const wallets = getWallets();
  const allocations = paymentAllocations(payment);
  const defaultWalletId = allocations.length === 1 ? String(allocations[0]?.walletId || '') : '';
  const options = [{ value: '', label: 'Кошелёк возврата' }, ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))];
  const refundHistory = refunds.length ? `<div class="entity-details">${refunds.map((item) => `<div><span>Возврат ${escapeHtml(paymentDateTime(item))}</span><strong>${escapeHtml(money(item.total))} · ${escapeHtml(item.walletName || 'Кошелёк')}</strong></div>`).join('')}</div>` : '';
  const html = `<div class="modal-title"><h2>Возврат оплаты</h2></div>
    ${paymentFactMarkup(payment)}
    ${refundHistory}
    <div class="payment-refund-form">
      <label class="payment-refund-amount"><span>Сумма возврата</span><input type="number" min="0" max="${remaining}" step="0.01" inputmode="decimal" value="${remaining}" data-refund-amount></label>
      ${select({ value: defaultWalletId, options, data: 'data-refund-wallet', aria: 'Кошелёк возврата' })}
      ${button(remaining === Number(payment.total || 0) ? 'Вернуть полностью' : 'Подтвердить возврат', { data: 'data-refund-submit' })}
    </div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  const walletInput = m.querySelector('input[data-refund-wallet]');
  const amountInput = m.querySelector('[data-refund-amount]');
  const submit = m.querySelector('[data-refund-submit]');
  const sync = () => {
    const amount = Math.max(0, Math.min(remaining, Number(String(amountInput?.value || '0').replace(',', '.')) || 0));
    if (submit) {
      submit.disabled = !walletInput?.value || !amount;
      submit.textContent = amount === remaining && refunded === 0 ? 'Вернуть полностью' : 'Подтвердить возврат';
    }
  };
  walletInput?.addEventListener('change', sync);
  amountInput?.addEventListener('input', sync);
  submit?.addEventListener('click', () => {
    const amount = Math.max(0, Math.min(remaining, Number(String(amountInput?.value || '0').replace(',', '.')) || 0));
    const wallet = wallets.find((item) => String(item.id || '') === String(walletInput?.value || ''));
    if (!amount || !wallet) return;
    const refund = refundPayment(payment.id, { amount, walletId: wallet.id, walletName: wallet.name });
    if (refund) m.remove();
  });
  sync();
}

function openPaidState(record) {
  const payment = getCompletedPaymentForSource('record', record?.id);
  if (!payment) return;
  const refunds = getRefundsForPayment(payment.id);
  const refunded = refunds.reduce((sum, item) => sum + Number(item?.total || 0), 0);
  const html = `<div class="modal-title"><h2>Оплачено</h2></div>${paymentFactMarkup(payment)}${refunded > 0 ? `<div class="entity-details"><div><span>Возвращено</span><strong>${escapeHtml(money(refunded))}</strong></div></div>` : ''}<div class="modal-actions">${button('Редактировать оплату', { data: 'data-edit-payment' })}${button('Возврат оплаты', { variant: 'secondary', data: 'data-refund-payment' })}</div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-edit-payment]')?.addEventListener('click', () => {
    m.remove();
    openPaymentEditor(record, payment);
  });
  m.querySelector('[data-refund-payment]')?.addEventListener('click', () => openRefundModal(payment));
}

export function openRecordPaymentEntry(record) {
  if (!record?.id) return () => {};
  const bottom = mountModal(document.body, modal(paymentEntryContent(record), { variant: 'bottom' }));
  if (!bottom) return () => {};

  const bindEntry = (current) => {
    bottom.querySelector('[data-record-payment-open]')?.addEventListener('click', () => openPaymentModal(current));
    bottom.querySelector('[data-record-payment-paid]')?.addEventListener('click', () => openPaidState(current));
  };
  const renderPaymentState = () => {
    const current = getRecords().find((item) => String(item?.id || '') === String(record.id)) || record;
    const sheet = bottom.querySelector('.modal-sheet');
    if (!sheet) return;
    sheet.innerHTML = paymentEntryContent(current);
    bindEntry(current);
  };
  const onRecordsChanged = (event) => {
    if (String(event?.detail?.recordId || '') === String(record.id)) renderPaymentState();
  };
  const onPaymentsChanged = (event) => {
    const source = event?.detail?.source;
    if (String(source?.type || '') === 'record' && String(source?.id || '') === String(record.id)) renderPaymentState();
  };

  bindEntry(record);
  window.addEventListener('book:records-changed', onRecordsChanged);
  window.addEventListener('book:payments-changed', onPaymentsChanged);
  return () => {
    window.removeEventListener('book:records-changed', onRecordsChanged);
    window.removeEventListener('book:payments-changed', onPaymentsChanged);
    bottom.remove();
  };
}
