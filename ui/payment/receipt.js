import { escapeHtml } from '../utils/escape-html.js';

const value = (input, fallback = '—') => {
  const text = String(input ?? '').trim();
  return escapeHtml(text || fallback);
};

export function paymentReceipt({
  workplace = '',
  date = '',
  time = '',
  person = {},
  amount = '',
  wallet = '',
  tips = '',
} = {}) {
  const uei = String(person?.uei || '').trim();
  const name = String(person?.name || '').trim();
  const personBlock = uei || name
    ? `<div class="payment-receipt__person">${uei ? `<span class="payment-receipt__uei">${escapeHtml(uei)}</span>` : ''}${name ? `<strong>${escapeHtml(name)}</strong>` : ''}</div>`
    : '';
  const tipsBlock = String(tips ?? '').trim()
    ? `<div class="payment-receipt__split payment-receipt__tips"><span>Tips</span><strong>${value(tips)}</strong></div>`
    : '';

  return `<section class="payment-receipt">
    <strong class="payment-receipt__workplace">${value(workplace, 'Рабочее пространство')}</strong>
    <div class="payment-receipt__split"><strong>${value(date)}</strong><strong>${value(time)}</strong></div>
    ${personBlock}
    <div class="payment-receipt__split"><strong>${value(amount)}</strong><strong>${value(wallet)}</strong></div>
    ${tipsBlock}
  </section>`;
}
