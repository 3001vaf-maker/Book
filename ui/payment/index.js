import { escapeHtml } from '../utils/escape-html.js';

const moneyValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
};

export function paymentForm({ workplace = '', date = '', time = '', client = {}, procedures = [], total = 0 } = {}) {
  const procedureBlocks = (Array.isArray(procedures) ? procedures : []).map((procedure, index) => `
    <section class="payment-procedure" data-payment-procedure="${index}">
      <strong class="payment-procedure__name">${escapeHtml(procedure?.name || '')}</strong>
      <div class="payment-fields payment-fields--three">
        <label><span>Цена</span><input type="number" inputmode="decimal" value="${escapeHtml(moneyValue(procedure?.cost))}" data-payment-price></label>
        <label><span>Скидка %</span><input type="number" inputmode="decimal" value="" data-payment-discount-percent></label>
        <label><span>Скидка ₽</span><input type="number" inputmode="decimal" value="" data-payment-discount-money></label>
      </div>
    </section>`).join('');

  const uei = client?.uei ? `<span>${escapeHtml(client.uei)}</span>` : '';
  const name = escapeHtml(client?.name || '');

  return `<div class="payment-ui">
    <div class="payment-readonly-block"><strong>${escapeHtml(workplace)}</strong></div>
    <div class="payment-readonly-block"><span>${escapeHtml(date)}</span><span>${escapeHtml(time)}</span></div>
    <div class="payment-readonly-block">${uei}<strong>${name}</strong></div>
    <div class="payment-procedures">${procedureBlocks}</div>
    <label class="payment-total"><span>Итого</span><input type="number" inputmode="decimal" value="${escapeHtml(moneyValue(total))}" data-payment-total readonly></label>
  </div>`;
}
