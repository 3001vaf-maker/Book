import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const moneyText = (value) => String(Math.round(numberValue(value) * 100) / 100);

function walletOptions(wallets = []) {
  return [{ value: '', label: 'Кошелёк' }, ...(Array.isArray(wallets) ? wallets : []).map((wallet) => ({
    value: String(wallet?.id || ''),
    label: String(wallet?.name || 'Кошелёк'),
  }))];
}

export function singlePaymentMarkup({ wallets = [], total = 0 } = {}) {
  return `<div class="payment-methods__single" data-payment-single-owner>
    <div class="payment-methods__amount"><span>Сумма</span><strong>${escapeHtml(moneyText(total))} ₽</strong></div>
    ${select({ value: '', options: walletOptions(wallets), data: 'data-payment-single-wallet', aria: 'Кошелёк оплаты' })}
    ${button('Подтвердить оплату', { data: 'data-payment-single-submit disabled' })}
  </div>`;
}

export function initSinglePayment(root, { wallets = [], onPay = () => {} } = {}) {
  if (!root) return;
  const walletInput = root.querySelector('input[data-payment-single-wallet]');
  const submit = root.querySelector('[data-payment-single-submit]');
  const sync = () => { if (submit) submit.disabled = !walletInput?.value; };
  walletInput?.addEventListener('change', sync);
  submit?.addEventListener('click', () => {
    const id = String(walletInput?.value || '');
    if (!id) return;
    const wallet = (Array.isArray(wallets) ? wallets : []).find((item) => String(item?.id || '') === id);
    onPay?.({ id, name: String(wallet?.name || '') });
  });
  sync();
}
