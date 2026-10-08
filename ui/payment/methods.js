import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { field } from '../inputs/index.js';
import { readOnlyReceipt } from '../receipt/index.js';

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

function sourceKey(type, id) {
  return `${type}:${String(id || '')}`;
}

function paymentSourceOptions(wallets = [], deposits = []) {
  return [
    { value: '', label: 'Источник оплаты' },
    ...(Array.isArray(wallets) ? wallets : []).map((wallet) => ({
      value: sourceKey('wallet', wallet?.id),
      label: String(wallet?.name || 'Кошелёк'),
    })),
    ...(Array.isArray(deposits) ? deposits : [])
      .filter((deposit) => Number(deposit?.balance || 0) > 0.009)
      .map((deposit) => ({
        value: sourceKey('deposit', deposit?.depositId || deposit?.id),
        label: `${String(deposit?.programName || deposit?.name || 'Депозит')} · остаток ${moneyDisplay(deposit?.balance)}`,
      })),
  ];
}

function allocationRow(index, wallets, deposits, initial = {}) {
  const amount = initial?.amount == null ? '' : moneyInputText(initial.amount);
  const selected = initial?.depositId
    ? sourceKey('deposit', initial.depositId)
    : (initial?.walletId ? sourceKey('wallet', initial.walletId) : '');
  return `<div class="form-grid" data-payment-allocation-row="${index}">
    ${select({
      label: 'Источник оплаты',
      value: selected,
      options: paymentSourceOptions(wallets, deposits),
      data: `data-payment-allocation-source="${index}"`,
      aria: `Источник оплаты ${index + 1}`,
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

function normalizeWalletAllocations(allocations = []) {
  return (Array.isArray(allocations) ? allocations : []).map((item) => ({
    walletId: String(item?.walletId || ''),
    walletName: String(item?.walletName || ''),
    amount: Math.max(0, numberValue(item?.amount)),
  })).filter((item) => item.walletId || item.amount > 0);
}

function normalizeDepositAllocations(allocations = []) {
  return (Array.isArray(allocations) ? allocations : []).map((item) => ({
    depositId: String(item?.depositId || item?.id || ''),
    name: String(item?.name || item?.programName || ''),
    balance: Math.max(0, numberValue(item?.balance)),
    amount: Math.max(0, numberValue(item?.amount)),
  })).filter((item) => item.depositId || item.amount > 0);
}

export function paymentAllocationState(allocations = [], total = 0, depositAllocations = []) {
  const wallets = normalizeWalletAllocations(allocations);
  const deposits = normalizeDepositAllocations(depositAllocations);
  const due = Math.max(0, numberValue(total));
  const cashReceived = wallets.reduce((sum, item) => sum + item.amount, 0);
  const depositReceived = deposits.reduce((sum, item) => sum + item.amount, 0);
  const depositValid = deposits.every((item) => item.depositId && item.amount > 0 && (!item.balance || item.amount <= item.balance + 0.009));
  const sourcesValid = wallets.every((item) => item.walletId && item.amount > 0) && depositValid;
  const depositOverflow = depositReceived > due + 0.009;
  const serviceFromCash = Math.min(cashReceived, Math.max(0, due - depositReceived));
  const applied = Math.min(due, depositReceived + serviceFromCash);
  const tips = Math.max(0, cashReceived - serviceFromCash);
  const remaining = Math.max(0, due - applied);
  const received = cashReceived + depositReceived;
  const valid = received > 0 && sourcesValid && !depositOverflow;
  return {
    allocations: wallets,
    depositAllocations: deposits.map(({ balance, ...item }) => item),
    cashReceived,
    depositReceived,
    received,
    tips,
    applied,
    remaining,
    valid,
  };
}

export function paymentMethodsMarkup({
  wallets = [],
  deposits = [],
  total = 0,
  initialAllocations = [],
  initialDepositAllocations = [],
  showAction = true,
  showTotal = true,
} = {}) {
  const initial = [
    ...(Array.isArray(initialDepositAllocations) ? initialDepositAllocations.map((item) => ({ ...item, depositId: item?.depositId || item?.id })) : []),
    ...(Array.isArray(initialAllocations) ? initialAllocations : []),
  ];
  const rowCount = Math.max(2, Math.min(4, initial.length || 0));
  return `<div class="form-grid" data-payment-allocation-owner>
    ${showTotal ? `<div data-payment-remaining>${totalReceipt('К оплате', total)}</div>` : ''}
    <div class="form-grid">
      ${Array.from({ length: rowCount }, (_, index) => allocationRow(index, wallets, deposits, initial[index] || {})).join('')}
    </div>
    <div data-payment-tips-row hidden></div>
    ${showAction ? `<div class="modal-actions">${button('Сохранить', { data: 'data-payment-allocation-submit' })}</div>` : ''}
  </div>`;
}

export function initPaymentMethodsAllocation(root, { wallets = [], deposits = [], total = 0, onPay = () => {}, onChange = () => {} } = {}) {
  if (!root) return null;
  const remainingNode = root.querySelector('[data-payment-remaining]');
  const tipsRow = root.querySelector('[data-payment-tips-row]');
  const submit = root.querySelector('[data-payment-allocation-submit]');
  const rows = () => [...root.querySelectorAll('[data-payment-allocation-row]')].map((part) => ({
    sourceInput: part.querySelector('input[data-payment-allocation-source]'),
    amountInput: part.querySelector('[data-payment-allocation-amount]'),
  }));
  const walletById = new Map((Array.isArray(wallets) ? wallets : []).map((item) => [String(item?.id || ''), item]));
  const depositById = new Map((Array.isArray(deposits) ? deposits : []).map((item) => [String(item?.depositId || item?.id || ''), item]));

  function normalizedSources() {
    const walletAllocations = [];
    const depositAllocations = [];
    for (const { sourceInput, amountInput } of rows()) {
      const value = String(sourceInput?.value || '');
      const amount = Math.max(0, numberValue(amountInput?.value));
      if (!value && amount <= 0) continue;
      const separator = value.indexOf(':');
      const type = separator >= 0 ? value.slice(0, separator) : '';
      const id = separator >= 0 ? value.slice(separator + 1) : '';
      if (type === 'wallet') {
        const wallet = walletById.get(id);
        walletAllocations.push({ walletId: id, walletName: String(wallet?.name || ''), amount });
      } else if (type === 'deposit') {
        const deposit = depositById.get(id);
        depositAllocations.push({
          depositId: id,
          name: String(deposit?.programName || deposit?.name || 'Депозит'),
          balance: Math.max(0, numberValue(deposit?.balance)),
          amount,
        });
      } else {
        walletAllocations.push({ walletId: '', walletName: '', amount });
      }
    }
    return { walletAllocations, depositAllocations };
  }

  function state() {
    const values = normalizedSources();
    return paymentAllocationState(values.walletAllocations, total, values.depositAllocations);
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

  rows().forEach(({ sourceInput, amountInput }) => {
    sourceInput?.addEventListener('change', () => {
      const value = String(sourceInput.value || '');
      if (value.startsWith('deposit:')) {
        const deposit = depositById.get(value.slice('deposit:'.length));
        const current = Math.max(0, numberValue(amountInput?.value));
        const maximum = Math.max(0, numberValue(deposit?.balance));
        if (amountInput && current > maximum) amountInput.value = moneyInputText(maximum);
      }
      sync();
    });
    amountInput?.addEventListener('input', () => {
      const value = String(sourceInput?.value || '');
      if (value.startsWith('deposit:')) {
        const deposit = depositById.get(value.slice('deposit:'.length));
        const maximum = Math.max(0, numberValue(deposit?.balance));
        if (numberValue(amountInput.value) > maximum) amountInput.value = moneyInputText(maximum);
      }
      sync();
    });
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
      depositAllocations: current.depositAllocations,
      receivedAmount: current.received,
      cashReceivedAmount: current.cashReceived,
      depositReceivedAmount: current.depositReceived,
      appliedAmount: current.applied,
      tips: current.tips,
    });
  });
  const initial = sync();
  return { state, sync, initial };
}
