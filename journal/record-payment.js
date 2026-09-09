import { initPaymentForm, modal, mountModal, paymentForm } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { getRecords } from './record-data.js';

function recordTotal(record) {
  return (Array.isArray(record?.procedures) ? record.procedures : []).reduce((sum, item) => {
    const value = Number(item?.cost);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function paymentEntryContent(record) {
  return `<button type="button" class="modal-bottom-action" data-record-payment-open aria-label="Открыть оплату, к оплате ${recordTotal(record)} рублей"><span>К оплате</span><strong>${recordTotal(record)} ₽</strong></button>`;
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

function paymentMoment() {
  const now = new Date();
  return {
    date: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
}

function openPaymentModal(record) {
  const current = getRecords().find((item) => String(item?.id || '') === String(record?.id || '')) || record;
  const moment = paymentMoment();
  const content = `<div class="modal-title"><h2>Оплата</h2></div>${paymentForm({
    workplace: workplaceName(current.workplaceId),
    date: moment.date,
    time: moment.time,
    client: recordClient(current),
    procedures: current.procedures || [],
    total: recordTotal(current),
  })}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  initPaymentForm(m.querySelector('[data-payment-ui]'));
}

export function openRecordPaymentEntry(record) {
  if (!record?.id) return () => {};
  const bottom = mountModal(document.body, modal(paymentEntryContent(record), { variant: 'bottom' }));
  if (!bottom) return () => {};

  const renderAmount = () => {
    const current = getRecords().find((item) => String(item?.id || '') === String(record.id));
    const action = bottom.querySelector('[data-record-payment-open]');
    if (!current || !action) return;
    const amount = recordTotal(current);
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
