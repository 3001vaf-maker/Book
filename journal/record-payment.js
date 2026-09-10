import { button, escapeHtml, initPaymentForm, initPaymentMethods, modal, mountModal, paymentForm, paymentMethods, select } from '../ui/ui.js';
import { calculateBusinessPlan } from '../core/business-model.js';
import { getActivePaymentForSource, getRefundsForPayment, recordPaymentIncome, recordRefundExpense } from '../core/dds.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { getWallets } from '../settings/wallets/data.js';
import { getRecords, updateRecord } from './record-data.js';

const money = (value) => `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₽`;

function clientForRecord(record) {
  const source = record?.client || {};
  const people = getAllClients();
  return people.find((item) => String(item?.key ?? '') === String(source?.key ?? ''))
    || people.find((item) => String(item?.id ?? '') === String(source?.id ?? ''))
    || source;
}

function financeForRecord(record) {
  return record?.finance || calculateBusinessPlan(record?.procedures || []);
}

function paymentEntryContent(record) {
  const completed = getActivePaymentForSource('record', record?.id);
  if (completed) return `<button type="button" class="modal-bottom-action modal-bottom-action--paid" data-record-payment-paid aria-label="Открыть оплату ${completed.total} рублей"><strong>Оплачено</strong><strong>${money(completed.total)}</strong></button>`;
  const total = Number(financeForRecord(record)?.planTotal || 0);
  return `<button type="button" class="modal-bottom-action" data-record-payment-open aria-label="Открыть оплату, к оплате ${total} рублей"><span>К оплате</span><strong>${money(total)}</strong></button>`;
}

function workplaceName(id) {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(id || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function recordClient(record) {
  const current = clientForRecord(record);
  const display = clientDisplay(current);
  return {
    uei: display.uei || '',
    name: display.name || '',
  };
}

function paymentMoment(now = new Date()) {
  return {
    date: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
}

function paymentFromRecord(record) {
  const moment = paymentMoment();
  return {
    source: { type: 'record', id: record?.id || '' },
    workplace: workplaceName(record?.workplaceId),
    client: recordClient(record),
    date: moment.date,
    time: moment.time,
    business: financeForRecord(record),
  };
}

function paymentAllocations(payment) {
  if (Array.isArray(payment?.allocations) && payment.allocations.length) return payment.allocations.map((item) => ({ ...item }));
  if (payment?.walletId) return [{ walletId: payment.walletId, walletName: payment.walletName || '', amount: Number(payment.total || 0) }];
  return [];
}

function paymentDateTime(payment) {
  const value = payment?.refundedAt || payment?.paidAt || payment?.createdAt;
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('ru-RU'),
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  };
}

function walletSummary(payment) {
  const allocations = paymentAllocations(payment);
  if (!allocations.length) return payment?.walletName || '—';
  return allocations.map((item) => item.walletName || 'Кошелёк').join(' · ');
}

function paymentFactMarkup(payment) {
  const when = paymentDateTime(payment);
  return `<div class="entity-details">
    <div><span>Дата</span><strong>${escapeHtml([when.date, when.time].filter(Boolean).join(' · ') || '—')}</strong></div>
    <div><span>Сумма</span><strong>${escapeHtml(money(payment?.total))} · ${escapeHtml(walletSummary(payment))}</strong></div>
  </div>`;
}

function openPaymentMethodsModal(payment, paymentModal) {
  const total = Number(payment?.business?.planTotal || 0);
  const content = `<div class="modal-title"><h2>Способ оплаты</h2></div>${paymentMethods({ wallets: getWallets(), total })}`;
  const methodsModal = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!methodsModal) return;

  const finish = (completed) => {
    if (!completed) return;
    if (completed?.source?.type === 'record' && completed?.source?.id) {
      updateRecord(completed.source.id, { attendance: 'arrived' });
    }
    methodsModal.remove();
    paymentModal?.remove();
  };

  initPaymentMethods(methodsModal.querySelector('[data-payment-methods]'), {
    onWallet: (wallet) => finish(recordPaymentIncome({
      source: payment.source,
      workplace: payment.workplace,
      client: payment.client,
      business: payment.business,
      allocations: [{ walletId: wallet.id, walletName: wallet.name, amount: total }],
    })),
    onSplit: (allocations) => finish(recordPaymentIncome({
      source: payment.source,
      workplace: payment.workplace,
      client: payment.client,
      business: payment.business,
      allocations,
    })),
  });
}

function openPaymentModal(record) {
  if (getActivePaymentForSource('record', record?.id)) return;
  const current = getRecords().find((item) => String(item?.id || '') === String(record?.id || '')) || record;
  const payment = paymentFromRecord(current);
  const finance = payment.business;
  const content = `<div class="modal-title"><h2>Оплата</h2></div>${paymentForm({
    workplace: payment.workplace,
    date: payment.date,
    time: payment.time,
    client: payment.client || {},
    procedures: (finance?.items || []).map((item) => ({ sourceType: item.sourceType || 'procedure', id: item.sourceId, name: item.name, cost: item.price, discountMode: item.discountMode, discountPercent: item.discountPercent, discountMoney: item.discountMoney })),
    total: finance?.planTotal || 0,
  })}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  initPaymentForm(m.querySelector('[data-payment-ui]'), {
    calculate: (items) => calculateBusinessPlan(items),
    onPay: ({ business }) => {
      const updated = updateRecord(current.id, { finance: business });
      if (!updated) return;
      openPaymentMethodsModal({ ...paymentFromRecord(updated), business: updated.finance }, m);
    },
  });
}

function refundHistoryMarkup(refunds) {
  if (!refunds.length) return '';
  return `<div class="entity-details">${refunds.map((item) => {
    const when = paymentDateTime(item);
    return `<div><span>${escapeHtml([when.date, when.time].filter(Boolean).join(' · ') || 'Возврат')}</span><strong>${escapeHtml(money(item.total))} · ${escapeHtml(item.walletName || 'Кошелёк')}</strong></div>`;
  }).join('')}</div>`;
}

function openRefundModal(payment) {
  const refunds = getRefundsForPayment(payment.id);
  const refunded = refunds.reduce((sum, item) => sum + Number(item?.total || 0), 0);
  const remaining = Math.max(0, Number(payment.total || 0) - refunded);
  if (!remaining) {
    mountModal(document.body, modal(`<div class="modal-title"><h2>Возврат выполнен</h2></div>${paymentFactMarkup(payment)}${refundHistoryMarkup(refunds)}`, { variant: 'compact', surface: 'app' }));
    return;
  }
  const wallets = getWallets();
  const allocations = paymentAllocations(payment);
  const defaultWalletId = allocations.length === 1 ? String(allocations[0]?.walletId || '') : '';
  const options = [{ value: '', label: 'Кошелёк возврата' }, ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))];
  const html = `<div class="modal-title"><h2>Возврат оплаты</h2></div>
    ${paymentFactMarkup(payment)}
    ${refundHistoryMarkup(refunds)}
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
    const refund = recordRefundExpense(payment.id, { amount, walletId: wallet.id, walletName: wallet.name });
    if (!refund) return;
    if (refund?.source?.type === 'record' && refund?.source?.id) updateRecord(refund.source.id, {});
    m.remove();
  });
  sync();
}

function openPaidState(record) {
  const payment = getActivePaymentForSource('record', record?.id);
  if (!payment) return;
  const refunds = getRefundsForPayment(payment.id);
  const html = `<div class="modal-title"><h2>Оплачено</h2></div>${paymentFactMarkup(payment)}${refundHistoryMarkup(refunds)}<div class="modal-actions">${button('Возврат оплаты', { variant: 'secondary', data: 'data-refund-payment' })}</div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-refund-payment]')?.addEventListener('click', () => {
    m.remove();
    openRefundModal(payment);
  });
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
  const onDDSChanged = (event) => {
    const source = event?.detail?.source;
    if (String(source?.type || '') === 'record' && String(source?.id || '') === String(record.id)) renderPaymentState();
  };

  bindEntry(record);
  window.addEventListener('book:records-changed', onRecordsChanged);
  window.addEventListener('book:dds-changed', onDDSChanged);
  return () => {
    window.removeEventListener('book:records-changed', onRecordsChanged);
    window.removeEventListener('book:dds-changed', onDDSChanged);
    bottom.remove();
  };
}
