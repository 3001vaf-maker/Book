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

function splitPart(index, wallets) {
  return `<div class="payment-split-part" data-payment-split-part="${index}">
    ${select({ value: '', options: walletOptions(wallets), data: `data-payment-split-wallet="${index}"`, aria: `Кошелёк части ${index + 1}` })}
    <input class="payment-split-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Сумма" data-payment-split-amount="${index}">
  </div>`;
}

export function splitPaymentMarkup({ wallets = [], total = 0 } = {}) {
  return `<div class="payment-methods__split" data-payment-split-owner>
    <div class="payment-methods__amount" data-payment-split-remaining><span>Сумма</span><strong>${escapeHtml(moneyText(total))} ₽</strong></div>
    <div data-payment-split-parts>
      ${splitPart(0, wallets)}
      ${splitPart(1, wallets)}
    </div>
    ${button('Подтвердить оплату', { data: 'data-payment-split-submit disabled' })}
  </div>`;
}

export function initSplitPayment(root, { wallets = [], total = 0, onPay = () => {} } = {}) {
  if (!root) return;
  const partsHost = root.querySelector('[data-payment-split-parts]');
  const remainingNode = root.querySelector('[data-payment-split-remaining]');
  const submit = root.querySelector('[data-payment-split-submit]');

  const values = () => [...root.querySelectorAll('[data-payment-split-part]')].map((part) => ({
    part,
    walletInput: part.querySelector('input[data-payment-split-wallet]'),
    amountInput: part.querySelector('[data-payment-split-amount]'),
  }));

  const walletName = (id) => (Array.isArray(wallets) ? wallets : []).find((item) => String(item?.id || '') === String(id || ''))?.name || '';

  const bindPart = (part) => {
    part.querySelector('input[data-payment-split-wallet]')?.addEventListener('change', recalc);
    part.querySelector('[data-payment-split-amount]')?.addEventListener('input', recalc);
  };

  const ensureThird = (show) => {
    const existing = root.querySelector('[data-payment-split-part="2"]');
    if (show && !existing && partsHost) {
      partsHost.insertAdjacentHTML('beforeend', splitPart(2, wallets));
      const third = root.querySelector('[data-payment-split-part="2"]');
      if (third) bindPart(third);
    } else if (!show && existing) {
      existing.remove();
    }
  };

  function recalc() {
    let rows = values();
    const first = Math.max(0, numberValue(rows[0]?.amountInput?.value));
    const second = Math.max(0, numberValue(rows[1]?.amountInput?.value));
    ensureThird(first > 0 && second > 0 && first + second < total - 0.009);
    rows = values();
    const used = rows.reduce((sum, { amountInput }) => sum + Math.max(0, numberValue(amountInput?.value)), 0);
    const remaining = Math.max(0, total - used);
    if (remainingNode) remainingNode.innerHTML = `<span>Сумма</span><strong>${escapeHtml(moneyText(remaining))} ₽</strong>`;
    const complete = Math.abs(used - total) <= 0.009
      && rows.filter(({ amountInput }) => numberValue(amountInput?.value) > 0).every(({ walletInput }) => Boolean(walletInput?.value));
    if (submit) submit.disabled = !complete;
  }

  values().forEach(({ part }) => bindPart(part));
  submit?.addEventListener('click', () => {
    const allocations = values().map(({ walletInput, amountInput }) => ({
      walletId: String(walletInput?.value || ''),
      walletName: String(walletName(walletInput?.value) || ''),
      amount: Math.max(0, numberValue(amountInput?.value)),
    })).filter((item) => item.amount > 0);
    const used = allocations.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(used - total) > 0.009 || allocations.some((item) => !item.walletId)) return;
    onPay?.(allocations);
  });
  recalc();
}
