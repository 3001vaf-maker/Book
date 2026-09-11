import { button, details, initPaymentForm, initPaymentMethods, modal, mountModal, paymentForm, paymentMethods, paymentReceipt, select, shortDate, shortDateTimeParts, shortTime } from '../ui/ui.js';
import { calculateFinancialPlan, getRecordPaymentState, recordFinancialItems } from '../core/financial-model.js';
import { getRefundsForPayment, recordPaymentIncome, recordRefundExpense } from '../core/dds.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { getWallets } from '../settings/wallets/data.js';
import { getRecord } from './record-read.js';
import { setRecordAttendance, updateRecord } from './record-service.js';

const money = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value || 0)).replaceAll('\u00a0', ' ')} ₽`;

function clientForRecord(record) {
  const source = record?.client || {};
  const people = getAllClients();
  return people.find((item) => String(item?.key ?? '') === String(source?.key ?? ''))
    || people.find((item) => String(item?.id ?? '') === String(source?.id ?? ''))
    || source;
}

function financeForRecord(record) {
  return record?.finance || calculateFinancialPlan(recordFinancialItems(record));
}

function paymentStateForRecord(record) {
  return getRecordPaymentState(record);
}

function sourcesFromFinance(sources, finance, type) {
  const items = Array.isArray(finance?.items) ? finance.items : [];
  return (Array.isArray(sources) ? sources : []).flatMap((source) => {
    const financialItem = items.find((item) => String(item?.sourceType || 'procedure') === type
      && String(item?.sourceId || '') === String(source?.id || ''));
    return financialItem ? [{ ...source, cost: financialItem.price }] : [];
  });
}

function saveFinancialCorrection(record, finance) {
  const current = getRecord(record?.id) || record;
  return updateRecord(current.id, {
    procedures: sourcesFromFinance(current?.procedures, finance, 'procedure'),
    products: sourcesFromFinance(current?.products, finance, 'product'),
    finance,
  });
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
    date: shortDate(now),
    time: shortTime(now),
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
    finance: financeForRecord(record),
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
    client: payment?.client || {},
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
    client: latest?.client || {},
    amount: money(receivedTotal),
    wallet: wallets.join(' + ') || '—',
    tips: Number(state?.tipsTotal || 0) > 0 ? money(state.tipsTotal) : '',
  });
}

function openPaymentMethodsModal(payment, paymentModal) {
  const recordState = getRecordPaymentState({ id: payment?.source?.id || '', finance: payment?.finance || null });
  const total = Number(recordState.remaining || 0);
  if (total <= 0.009) return;
  const content = `<div class="modal-title"><h2>Способ оплаты</h2></div>${paymentMethods({ wallets: getWallets(), total })}`;
  const methodsModal = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!methodsModal) return;

  const finish = (completed) => {
    if (!completed) return;
    if (completed?.source?.type === 'record' && completed?.source?.id) {
      setRecordAttendance(completed.source.id, 'arrived');
    }
    methodsModal.remove();
    paymentModal?.remove();
  };

  initPaymentMethods(methodsModal.querySelector('[data-payment-methods]'), {
    onPay: ({ allocations, tips, appliedAmount }) => finish(recordPaymentIncome({
      source: payment.source,
      workplace: payment.workplace,
      client: payment.client,
      finance: payment.finance,
      allocations,
      maxAmount: total,
      serviceAmount: appliedAmount,
      tips,
    })),
  });
}

function openPaymentModal(record) {
  if (paymentStateForRecord(record).fullyPaid) return;
  const current = getRecord(record?.id) || record;
  const payment = paymentFromRecord(current);
  const finance = payment.finance;
  const content = `<div class="modal-title"><h2>Оплата</h2></div>${paymentForm({
    workplace: payment.workplace,
    date: payment.date,
    time: payment.time,
    client: payment.client || {},
    procedures: (finance?.items || []).map((item) => ({ sourceType: item.sourceType || 'procedure', id: item.sourceId, name: item.name, cost: item.price, discountMode: item.discountMode, discountPercent: item.discountPercent, discountMoney: item.discountMoney })),
    total: finance?.planTotal || 0,
  })}`;
  const m = mountModal(document.body, modal(content, { variant: 'large', surface: 'app' }));
  if (!m) return;
  initPaymentForm(m.querySelector('[data-payment-ui]'), {
    calculate: (items) => calculateFinancialPlan(items),
    onRemove: ({ finance: updatedFinance }) => {
      saveFinancialCorrection(current, updatedFinance);
    },
    onSave: ({ finance: updatedFinance }) => {
      const updated = saveFinancialCorrection(current, updatedFinance);
      if (!updated) return;
      m.remove();
    },
    onPay: ({ finance: updatedFinance }) => {
      const updated = saveFinancialCorrection(current, updatedFinance);
      if (!updated) return;
      openPaymentMethodsModal({ ...paymentFromRecord(updated), finance: updated.finance }, m);
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
  submit?.addEventListener('click', () => {
    const amount = Math.max(0, Math.min(remaining, Number(String(amountInput?.value || '0').replace(',', '.')) || 0));
    const wallet = wallets.find((item) => String(item.id || '') === String(walletInput?.value || ''));
    if (!amount || !wallet) return;
    const refund = recordRefundExpense(payment.id, { amount, walletId: wallet.id, walletName: wallet.name });
    if (!refund) return;
    m.remove();
  });
  sync();
}

function openPaidState(record) {
  const state = paymentStateForRecord(record);
  if (!state.fullyPaid || !state.latestPayment) return;
  const payment = state.latestPayment;
  const refunds = getRefundsForPayment(payment.id);
  const html = `<div class="modal-title"><h2>Оплачено</h2></div>${sourcePaymentFactMarkup(state)}${refundHistoryMarkup(refunds)}<div class="modal-actions">${button('Возврат оплаты', { variant: 'danger', data: 'data-refund-payment' })}</div>`;
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
