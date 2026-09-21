import { button, details, field, initPaymentForm, initPaymentMethods, modal, mountModal, paymentForm, paymentMethods, paymentReceipt, select, shortDate, shortDateTimeParts, shortTime } from '../ui/ui.js';
import { calculateSettlement, getRecordPaymentState, recordSettlementItems } from '../core/finance/index.js';
import { cancelPaymentOperation, getRefundsForPayment, recordPaymentIncome, recordRefundExpense, saveSettlementSnapshot } from '../core/finance/index.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllPeople } from '../main/people/data.js';
import { personDisplay } from '../main/people/presentation.js';
import { getWallets } from '../settings/wallets/data.js';
import { getRecord } from '../core/record/index.js';
import { setRecordAttendance, updateRecord } from '../core/record/index.js';
import { journalRecordActionContext } from './record-action-context.js';

const money = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value || 0)).replaceAll('\u00a0', ' ')} ₽`;

function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}


function personForRecord(record) {
  const source = record?.person || {};
  const people = getAllPeople();
  return people.find((item) => String(item?.key ?? '') === String(source?.key ?? ''))
    || people.find((item) => String(item?.id ?? '') === String(source?.id ?? ''))
    || source;
}

function settlementForRecord(record) {
  return record?.finance || calculateSettlement(recordSettlementItems(record));
}

function paymentStateForRecord(record) {
  return getRecordPaymentState(record);
}

function sourcesFromSettlement(sources, settlement, type) {
  const items = Array.isArray(settlement?.items) ? settlement.items : [];
  return (Array.isArray(sources) ? sources : []).flatMap((source) => {
    const settlementItem = items.find((item) => String(item?.sourceType || 'procedure') === type
      && String(item?.sourceId || '') === String(source?.id || ''));
    return settlementItem ? [{ ...source, cost: settlementItem.price }] : [];
  });
}

async function saveSettlementCorrection(record, settlement) {
  const current = getRecord(record?.id) || record;
  const updated = updateRecord(current.id, {
    procedures: sourcesFromSettlement(current?.procedures, settlement, 'procedure'),
    products: sourcesFromSettlement(current?.products, settlement, 'product'),
  });
  if (!updated) return null;
  await saveSettlementSnapshot({
    source: { type: 'record', id: current.id },
    settlement,
  });
  return getRecord(current.id) || updated;
}

function paymentEntryContent(record) {
  const state = paymentStateForRecord(record);
  if (state.fullyPaid) {
    return `<button type="button" class="modal-bottom-action modal-bottom-action--paid" data-record-payment-paid aria-label="Открыть оплату ${state.paidTotal} рублей"><strong>Оплачено</strong><strong>${money(state.paidTotal)}</strong></button>`;
  }
  const partialClass = state.partiallyPaid ? ' modal-bottom-action--partial' : '';
  return `<button type="button" class="modal-bottom-action${partialClass}" data-record-payment-open aria-label="Открыть оплату, к оплате ${state.remaining} рублей"><span>К оплате</span><strong>${money(state.remaining)}</strong></button>`;
}

function workplaceName(id) {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(id || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function recordPerson(record) {
  const current = personForRecord(record);
  const display = personDisplay(current);
  return {
    uei: display.uei || '',
    name: display.name || '',
  };
}

function recordPaymentOccurredAtValue(record) {
  const date = String(record?.date || '').slice(0, 10);
  const time = String(record?.to || record?.from || '').slice(0, 5);
  if (date && /^\d{2}:\d{2}$/.test(time)) return `${date}T${time}`;
  if (date) return `${date}T12:00`;
  return localDateTimeValue();
}

function paymentMoment(record) {
  const raw = recordPaymentOccurredAtValue(record);
  const date = raw.slice(0, 10);
  const time = raw.slice(11, 16);
  return {
    date: date ? shortDate(new Date(`${date}T12:00:00`)) : '',
    time: time || '',
    occurredAtValue: raw,
  };
}

function paymentFromRecord(record) {
  const moment = paymentMoment(record);
  return {
    source: { type: 'record', id: record?.id || '' },
    workplace: workplaceName(record?.workplaceId),
    person: recordPerson(record),
    date: moment.date,
    time: moment.time,
    occurredAtValue: moment.occurredAtValue,
    settlement: settlementForRecord(record),
  };
}

function paymentAllocations(payment) {
  if (Array.isArray(payment?.allocations) && payment.allocations.length) return payment.allocations.map((item) => ({ ...item }));
  if (payment?.walletId) return [{ walletId: payment.walletId, walletName: payment.walletName || '', amount: Number(payment.total || 0) }];
  return [];
}

function paymentDateTime(payment) {
  const value = payment?.refundedAt || payment?.paidAt || payment?.createdAt;
  if (value) {
    const parts = shortDateTimeParts(value);
    if (parts.date) return parts;
  }
  return {
    date: String(payment?.date || ''),
    time: String(payment?.time || ''),
  };
}

function walletSummary(payment) {
  const allocations = paymentAllocations(payment);
  if (!allocations.length) return payment?.walletName || '—';
  return allocations.map((item) => item.walletName || 'Кошелёк').join(' + ');
}

function paymentFactMarkup(payment) {
  const when = paymentDateTime(payment);
  return paymentReceipt({
    workplace: payment?.workplace || '',
    date: when.date || '—',
    time: when.time || '—',
    person: payment?.person || {},
    amount: money(payment?.total),
    wallet: walletSummary(payment),
    tips: Number(payment?.tips || 0) > 0 ? money(payment.tips) : '',
  });
}

function sourcePaymentFactMarkup(state) {
  const payments = Array.isArray(state?.payments) ? state.payments : [];
  const latest = state?.latestPayment || payments[payments.length - 1] || null;
  if (!latest) return '';
  const when = paymentDateTime(latest);
  const wallets = [];
  payments.forEach((payment) => paymentAllocations(payment).forEach((allocation) => {
    const name = allocation.walletName || 'Кошелёк';
    if (!wallets.includes(name)) wallets.push(name);
  }));
  const receivedTotal = payments.reduce((sum, payment) => sum + Number(payment?.total || 0), 0);
  return paymentReceipt({
    workplace: latest?.workplace || '',
    date: when.date || '—',
    time: when.time || '—',
    person: latest?.person || {},
    amount: money(receivedTotal),
    wallet: wallets.join(' + ') || '—',
    tips: Number(state?.tipsTotal || 0) > 0 ? money(state.tipsTotal) : '',
  });
}

function openPaymentMethodsModal(payment, paymentModal) {
  const recordState = getRecordPaymentState({ id: payment?.source?.id || '', finance: payment?.settlement || null });
  const total = Number(recordState.remaining || 0);
  if (total <= 0.009) return;
  const content = `<div class="modal-title"><h2>Способ оплаты</h2></div>
    ${field({ label: 'Фактическая дата и время', name: 'paymentOccurredAt', type: 'datetime-local', value: payment?.occurredAtValue || localDateTimeValue(), required: true })}
    ${paymentMethods({ wallets: getWallets(), total })}`;
  const methodsModal = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!methodsModal) return;

  const finish = (completed) => {
    if (!completed) return;
    if (completed?.source?.type === 'record' && completed?.source?.id) {
      setRecordAttendance(completed.source.id, 'arrived', { actionContext: journalRecordActionContext() });
    }
    methodsModal.remove();
    paymentModal?.remove();
  };

  initPaymentMethods(methodsModal.querySelector('[data-payment-methods]'), {
    onPay: async ({ allocations, tips, appliedAmount }) => {
      const occurredAtInput = methodsModal.querySelector('input[name="paymentOccurredAt"]');
      if (!occurredAtInput?.value) return;
      const completed = await recordPaymentIncome({
        source: payment.source,
        workplace: payment.workplace,
        person: payment.person,
        settlement: payment.settlement,
        allocations,
        maxAmount: total,
        serviceAmount: appliedAmount,
        tips,
        occurredAt: new Date(occurredAtInput.value),
      });
      finish(completed);
    },
  });
}

function openPaymentModal(record) {
  if (paymentStateForRecord(record).fullyPaid) return;
  const current = getRecord(record?.id) || record;
  const payment = paymentFromRecord(current);
  const settlement = payment.settlement;
  const content = `<div class="modal-title"><h2>Оплата</h2></div>${paymentForm({
    workplace: payment.workplace,
    date: payment.date,
    time: payment.time,
    person: payment.person || {},
    procedures: (settlement?.items || []).map((item) => ({ sourceType: item.sourceType || 'procedure', id: item.sourceId, name: item.name, cost: item.price, discountMode: item.discountMode, discountPercent: item.discountPercent, discountMoney: item.discountMoney })),
    total: settlement?.planTotal || 0,
  })}`;
  const m = mountModal(document.body, modal(content, { variant: 'large', surface: 'app' }));
  if (!m) return;
  initPaymentForm(m.querySelector('[data-payment-ui]'), {
    calculate: (items) => calculateSettlement(items),
    onRemove: async ({ settlement: updatedSettlement }) => {
      await saveSettlementCorrection(current, updatedSettlement);
    },
    onSave: async ({ settlement: updatedSettlement }) => {
      const updated = await saveSettlementCorrection(current, updatedSettlement);
      if (!updated) return;
      m.remove();
    },
    onPay: async ({ settlement: updatedSettlement }) => {
      const updated = await saveSettlementCorrection(current, updatedSettlement);
      if (!updated) return;
      openPaymentMethodsModal({ ...paymentFromRecord(updated), settlement: updatedSettlement }, m);
    },
  });
}

function refundHistoryMarkup(refunds) {
  if (!refunds.length) return '';
  return `<div class="payment-refund-history">${refunds.map((item) => {
    const when = paymentDateTime(item);
    return `<div class="payment-refund-history__item"><strong class="payment-refund-history__label">Возврат</strong>${details([
      { left: when.date || '—', right: when.time || '—' },
      { left: money(item.total), right: item.walletName || 'Кошелёк' },
    ], { variant: 'split' })}</div>`;
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
      ${field({ label: 'Фактическая дата и время', name: 'refundOccurredAt', type: 'datetime-local', value: localDateTimeValue(), required: true })}
      ${button(remaining === Number(payment.total || 0) ? 'Вернуть полностью' : 'Подтвердить возврат', { variant: 'danger', data: 'data-refund-submit' })}
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
  submit?.addEventListener('click', async () => {
    const amount = Math.max(0, Math.min(remaining, Number(String(amountInput?.value || '0').replace(',', '.')) || 0));
    const wallet = wallets.find((item) => String(item.id || '') === String(walletInput?.value || ''));
    if (!amount || !wallet) return;
    const occurredAtInput = m.querySelector('input[name="refundOccurredAt"]');
    if (!occurredAtInput?.value) return;
    const refund = await recordRefundExpense(payment.id, {
      amount,
      walletId: wallet.id,
      walletName: wallet.name,
      occurredAt: new Date(occurredAtInput.value),
    });
    if (!refund) return;
    m.remove();
  });
  sync();
}

function openCancelPaymentModal(payment) {
  const html = `<div class="modal-title"><h2>Отменить операцию?</h2></div>
    ${paymentFactMarkup(payment)}
    <p>Неверный ввод останется в финансовой истории с пометкой «Отменена», но не будет участвовать в кошельках и расчётах.</p>
    <div class="modal-actions">${button('Подтвердить отмену', { variant: 'secondary', data: 'data-cancel-payment-confirm' })}</div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-cancel-payment-confirm]')?.addEventListener('click', async () => {
    const cancelled = await cancelPaymentOperation(payment.id, { reason: 'incorrect-entry' });
    if (!cancelled) return;
    m.remove();
  });
}

function openPaymentActions(payment) {
  const html = `<div class="modal-title"><h2>Действия с оплатой</h2></div>
    ${paymentFactMarkup(payment)}
    <div class="modal-actions">
      ${button('Отменить операцию', { variant: 'secondary', data: 'data-cancel-payment' })}
      ${button('Возврат', { variant: 'danger', data: 'data-refund-payment' })}
    </div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-cancel-payment]')?.addEventListener('click', () => {
    m.remove();
    openCancelPaymentModal(payment);
  });
  m.querySelector('[data-refund-payment]')?.addEventListener('click', () => {
    m.remove();
    openRefundModal(payment);
  });
}

function openPaidState(record) {
  const state = paymentStateForRecord(record);
  if (!state.fullyPaid || !state.latestPayment) return;
  const payment = state.latestPayment;
  const refunds = getRefundsForPayment(payment.id);
  const html = `<div class="modal-title"><h2>Оплачено</h2></div>${sourcePaymentFactMarkup(state)}${refundHistoryMarkup(refunds)}<div class="modal-actions">${button('Действия с оплатой', { variant: 'secondary', data: 'data-payment-actions' })}</div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-payment-actions]')?.addEventListener('click', () => {
    m.remove();
    openPaymentActions(payment);
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
    const current = getRecord(record.id) || record;
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
