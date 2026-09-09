import { modal, mountModal } from '../ui/ui.js';
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

function openPaymentModal() {
  mountModal(document.body, modal('<div class="modal-title"><h2>Оплата</h2></div>', { variant: 'medium', surface: 'app' }));
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

  bottom.querySelector('[data-record-payment-open]')?.addEventListener('click', openPaymentModal);
  window.addEventListener('book:records-changed', onRecordsChanged);

  return () => {
    window.removeEventListener('book:records-changed', onRecordsChanged);
    bottom.remove();
  };
}
