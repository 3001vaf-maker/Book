import { initPaymentForm, initPaymentMethods, modal, mountModal, paymentForm, paymentMethods } from '../ui/ui.js';
import { completePayment, createPaymentDraft, paymentTotal } from '../core/payment.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { getWallets } from '../settings/wallets/data.js';
import { getRecords } from './record-data.js';

function paymentEntryContent(record) {
  const total = paymentTotal(record?.procedures || []);
  return `<button type="button" class="modal-bottom-action" data-record-payment-open aria-label="Открыть оплату, к оплате ${total} рублей"><span>К оплате</span><strong>${total} ₽</strong></button>`;
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

function openPaymentMethodsModal(payment, values, paymentModal) {
  const content = `<div class="modal-title"><h2>Способы оплаты</h2></div>${paymentMethods({ wallets: getWallets() })}`;
  const methodsModal = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!methodsModal) return;
  initPaymentMethods(methodsModal.querySelector('[data-payment-methods]'), {
    onWallet: (wallet) => {
      const completed = completePayment(payment, {
        walletId: wallet.id,
        walletName: wallet.name,
        items: values.items,
        total: values.total,
      });
      if (!completed) return;
      methodsModal.remove();
      paymentModal?.remove();
    },
  });
}

function openPaymentModal(record) {
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
  initPaymentForm(m.querySelector('[data-payment-ui]'), {
    onPay: (values) => openPaymentMethodsModal(payment, values, m),
  });
}

export function openRecordPaymentEntry(record) {
  if (!record?.id) return () => {};
  const bottom = mountModal(document.body, modal(paymentEntryContent(record), { variant: 'bottom' }));
  if (!bottom) return () => {};

  const renderAmount = () => {
    const current = getRecords().find((item) => String(item?.id || '') === String(record.id));
    const action = bottom.querySelector('[data-record-payment-open]');
    if (!current || !action) return;
    const amount = paymentTotal(current.procedures || []);
    action.innerHTML = `<span>К оплате</span><strong>${amount} ₽</strong>`;
    action.setAttribute('aria-label', `Открыть оплату, к оплате ${amount} рублей`);
  };

  const onRecordsChanged = (event) => {
    if (String(event?.detail?.recordId || '') === String(record.id)) renderAmount();
  };

  bottom.querySelector('[data-record-payment-open]')?.addEventListener('click', () => openPaymentModal(record));
  window.addEventListener('book:records-changed', onRecordsChanged);

  return () => {
    window.removeEventListener('book:records-changed', onRecordsChanged);
    bottom.remove();
  };
}
