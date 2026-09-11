import { escapeHtml } from '../utils/escape-html.js';

const value = (input, fallback = '—') => {
  const text = String(input ?? '').trim();
  return escapeHtml(text || fallback);
};

export function paymentReceipt({
  workplace = '',
  date = '',
  time = '',
  client = {},
  amount = '',
  wallet = '',
  tips = '',
} = {}) {
  const uei = String(client?.uei || '').trim();
  const name = String(client?.name || '').trim();
  const clientBlock = uei || name
    ? `<div class="payment-receipt__client">${uei ? `<span class="payment-receipt__uei">${escapeHtml(uei)}</span>` : ''}${name ? `<strong>${escapeHtml(name)}</strong>` : ''}</div>`
    : '';
  const tipsBlock = String(tips ?? '').trim()
    ? `<div class="payment-receipt__split payment-receipt__tips"><span>Tips</span><strong>${value(tips)}</strong></div>`
    : '';

  return `<section class="payment-receipt">
    <strong class="payment-receipt__workplace">${value(workplace, 'Рабочее пространство')}</strong>
    <div class="payment-receipt__split"><strong>${value(date)}</strong><strong>${value(time)}</strong></div>
    ${clientBlock}
    <div class="payment-receipt__split"><strong>${value(amount)}</strong><strong>${value(wallet)}</strong></div>
    ${tipsBlock}
  </section>`;
}
