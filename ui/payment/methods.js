import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const moneyInputText = (value) => {
  const number = Math.max(0, numberValue(value));
  if (!number) return '';
  const rounded = Math.round(number * 100) / 100;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(rounded).replaceAll('\u00a0', ' ');
};

const moneyDisplay = (value) => `${moneyInputText(value) || '0'} ₽`;

function walletOptions(wallets = []) {
  return [{ value: '', label: 'Кошелёк' }, ...(Array.isArray(wallets) ? wallets : []).map((wallet) => ({
    value: String(wallet?.id || ''),
    label: String(wallet?.name || 'Кошелёк'),
  }))];
}

function allocationRow(index, wallets, initial = {}) {
  const amount = initial?.amount == null ? '' : moneyInputText(initial.amount);
  return `<div class="payment-allocation-row" data-payment-allocation-row="${index}">
    ${select({ value: String(initial?.walletId || ''), options: walletOptions(wallets), data: `data-payment-allocation-wallet="${index}"`, aria: `Кошелёк оплаты ${index + 1}` })}
    <input class="payment-allocation-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Сумма" value="${escapeHtml(amount)}" data-payment-allocation-amount="${index}">
  </div>`;
}

export function paymentMethodsMarkup({ wallets = [], total = 0, initialAllocations = [] } = {}) {
  const allocations = Array.isArray(initialAllocations) ? initialAllocations : [];
  return `<div class="payment-methods__allocation" data-payment-allocation-owner>
    <div class="payment-methods__total" data-payment-remaining><span>К оплате</span><strong>${escapeHtml(moneyDisplay(total))}</strong></div>
    <div class="payment-allocation-rows">
      ${allocationRow(0, wallets, allocations[0] || {})}
      ${allocationRow(1, wallets, allocations[1] || {})}
    </div>
    ${button('Сохранить', { data: 'data-payment-allocation-submit' })}
  </div>`;
}

export function initPaymentMethodsAllocation(root, { wallets = [], total = 0, onPay = () => {} } = {}) {
  if (!root) return;
  const remainingNode = root.querySelector('[data-payment-remaining] strong');
  const submit = root.querySelector('[data-payment-allocation-submit]');
  const rows = () => [...root.querySelectorAll('[data-payment-allocation-row]')].map((part) => ({
    walletInput: part.querySelector('input[data-payment-allocation-wallet]'),
    amountInput: part.querySelector('[data-payment-allocation-amount]'),
  }));
  const walletName = (id) => (Array.isArray(wallets) ? wallets : []).find((item) => String(item?.id || '') === String(id || ''))?.name || '';

  function normalizedAllocations() {
    return rows().map(({ walletInput, amountInput }) => ({
      walletId: String(walletInput?.value || ''),
      walletName: String(walletName(walletInput?.value) || ''),
      amount: Math.max(0, numberValue(amountInput?.value)),
    })).filter((item) => item.walletId || item.amount > 0);
  }

  function sync() {
    const allocations = normalizedAllocations();
    const used = allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const remaining = Math.max(0, total - used);
    if (remainingNode) remainingNode.textContent = moneyDisplay(remaining);
    const valid = allocations.length > 0
      && allocations.every((item) => item.walletId && item.amount > 0)
      && used <= total + 0.009;
    if (submit) submit.disabled = !valid;
  }

  rows().forEach(({ walletInput, amountInput }) => {
    walletInput?.addEventListener('change', sync);
    amountInput?.addEventListener('input', sync);
    amountInput?.addEventListener('blur', () => {
      const value = numberValue(amountInput.value);
      amountInput.value = value > 0 ? moneyInputText(value) : '';
      sync();
    });
  });

  submit?.addEventListener('click', () => {
    const allocations = normalizedAllocations();
    const used = allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (!allocations.length || allocations.some((item) => !item.walletId || !(item.amount > 0)) || used > total + 0.009) return;
    onPay?.(allocations);
  });
  sync();
}
