import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { field } from '../inputs/index.js';
import { readOnlyReceipt } from '../receipt/index.js';
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
  return `<div class="form-grid" data-payment-allocation-row="${index}">
    ${select({
      label: 'Кошелёк',
      value: String(initial?.walletId || ''),
      options: walletOptions(wallets),
      data: `data-payment-allocation-wallet="${index}"`,
      aria: `Кошелёк оплаты ${index + 1}`,
    })}
    ${field({
      label: 'Сумма',
      name: `paymentAllocationAmount${index}`,
      value: amount,
      type: 'text',
      inputmode: 'decimal',
      data: `data-payment-allocation-amount="${index}"`,
    })}
  </div>`;
}

function totalReceipt(label, value) {
  return readOnlyReceipt({ totals: [{ label, value: moneyDisplay(value), strong: true }] });
}

export function paymentAllocationState(allocations = [], total = 0) {
  const normalized = (Array.isArray(allocations) ? allocations : []).map((item) => ({
    ...item,
    walletId: String(item?.walletId || ''),
    walletName: String(item?.walletName || ''),
    amount: Math.max(0, numberValue(item?.amount)),
  })).filter((item) => item.walletId || item.amount > 0);
  const due = Math.max(0, numberValue(total));
  const received = normalized.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const applied = Math.min(due, received);
  const tips = Math.max(0, received - applied);
  const remaining = Math.max(0, due - applied);
  const valid = normalized.length > 0
    && normalized.every((item) => item.walletId && item.amount > 0)
    && received > 0;
  return { allocations: normalized, received, tips, applied, remaining, valid };
}

export function paymentMethodsMarkup({ wallets = [], total = 0, initialAllocations = [], showAction = true, showTotal = true } = {}) {
  const allocations = Array.isArray(initialAllocations) ? initialAllocations : [];
  return `<div class="form-grid" data-payment-allocation-owner>
    ${showTotal ? `<div data-payment-remaining>${totalReceipt('К оплате', total)}</div>` : ''}
    <div class="form-grid">
      ${allocationRow(0, wallets, allocations[0] || {})}
      ${allocationRow(1, wallets, allocations[1] || {})}
    </div>
    <div data-payment-tips-row hidden></div>
    ${showAction ? `<div class="modal-actions">${button('Сохранить', { data: 'data-payment-allocation-submit' })}</div>` : ''}
  </div>`;
}

export function initPaymentMethodsAllocation(root, { wallets = [], total = 0, onPay = () => {}, onChange = () => {} } = {}) {
  if (!root) return;
  const remainingNode = root.querySelector('[data-payment-remaining]');
  const tipsRow = root.querySelector('[data-payment-tips-row]');
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

  function state() {
    return paymentAllocationState(normalizedAllocations(), total);
  }

  function sync() {
    const current = state();
    if (remainingNode) remainingNode.innerHTML = totalReceipt('К оплате', current.remaining);
    if (tipsRow) {
      tipsRow.hidden = current.tips <= 0.009;
      tipsRow.innerHTML = current.tips > 0.009 ? totalReceipt('Tips', current.tips) : '';
    }
    if (submit) submit.disabled = !current.valid;
    onChange?.(current);
    return current;
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
    const current = state();
    if (!current.valid) return;
    onPay?.({
      allocations: current.allocations,
      receivedAmount: current.received,
      appliedAmount: current.applied,
      tips: current.tips,
    });
  });
  const initial = sync();
  return {
    state,
    sync,
    initial,
  };
}
