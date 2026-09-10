import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';
import { singlePaymentMarkup, initSinglePayment } from './single.js';
import { splitPaymentMarkup, initSplitPayment } from './split.js';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const moneyText = (value) => {
  const number = numberValue(value);
  return String(Math.round(number * 100) / 100);
};

const percentText = (value) => {
  const number = numberValue(value);
  if (!number) return '';
  return String(Math.round(number * 100) / 100);
};

const discountOptions = [
  { value: '', label: '—' },
  ...Array.from({ length: 100 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}%` })),
];

export function paymentForm({ workplace = '', date = '', time = '', client = {}, procedures = [], total = 0 } = {}) {
  const procedureBlocks = (Array.isArray(procedures) ? procedures : []).map((procedure, index) => {
    const price = Math.max(0, numberValue(procedure?.cost));
    const percent = Math.max(0, Math.min(100, numberValue(procedure?.discountPercent)));
    const money = Math.max(0, Math.min(price, numberValue(procedure?.discountMoney ?? (percent ? price * percent / 100 : 0))));
    return `
    <section class="payment-procedure" data-payment-procedure="${index}" data-payment-source-id="${escapeHtml(procedure?.id || '')}" data-payment-name="${escapeHtml(procedure?.name || '')}">
      <strong class="payment-procedure__name">${escapeHtml(procedure?.name || '')}</strong>
      <div class="payment-fields payment-fields--three">
        <label><span>Цена</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(moneyText(price))}" data-payment-price></label>
        <div class="payment-discount-percent">${select({ label: 'Скидка %', value: percent ? percentText(percent) : '', options: discountOptions, data: 'data-payment-discount-percent', aria: 'Скидка в процентах' })}</div>
        <label><span>Скидка ₽</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${money ? escapeHtml(moneyText(money)) : ''}" data-payment-discount-money></label>
      </div>
    </section>`;
  }).join('');

  const uei = client?.uei ? `<span>${escapeHtml(client.uei)}</span>` : '';
  const name = escapeHtml(client?.name || '');

  return `<div class="payment-ui" data-payment-ui>
    <div class="payment-readonly-block"><strong>${escapeHtml(workplace)}</strong></div>
    <div class="payment-readonly-block"><span>${escapeHtml(date)}</span><span>${escapeHtml(time)}</span></div>
    <div class="payment-readonly-block payment-readonly-block--client">${uei}<strong>${name}</strong></div>
    <div class="payment-procedures">${procedureBlocks}</div>
    <label class="payment-total"><span>Итого</span><input type="number" inputmode="decimal" value="${escapeHtml(moneyText(total))}" data-payment-total readonly></label>
    <div class="payment-submit">${button('Оплатить', { data: 'data-payment-submit' })}</div>
  </div>`;
}

export function paymentMethods({ wallets = [], total = 0, initialMode = 'single', initialAllocations = [] } = {}) {
  const walletData = escapeHtml(JSON.stringify(Array.isArray(wallets) ? wallets.map((wallet) => ({ id: String(wallet?.id || ''), name: String(wallet?.name || '') })) : []));
  const allocationData = escapeHtml(JSON.stringify(Array.isArray(initialAllocations) ? initialAllocations : []));
  const splitMode = initialMode === 'split';
  const firstAllocation = Array.isArray(initialAllocations) ? initialAllocations[0] || {} : {};
  const initialMarkup = splitMode
    ? splitPaymentMarkup({ wallets, total, initialAllocations })
    : singlePaymentMarkup({ wallets, total, initialWalletId: firstAllocation.walletId || '' });
  return `<div class="payment-methods" data-payment-methods data-payment-total="${escapeHtml(moneyText(total))}" data-payment-wallets="${walletData}" data-payment-initial-mode="${splitMode ? 'split' : 'single'}" data-payment-initial-allocations="${allocationData}">
    <div class="segment-control segment-control--two-equal" role="group" aria-label="Режим оплаты">
      <button type="button" class="${splitMode ? '' : 'is-active'}" aria-pressed="${splitMode ? 'false' : 'true'}" data-payment-mode="single">Оплата</button>
      <button type="button" class="${splitMode ? 'is-active' : ''}" aria-pressed="${splitMode ? 'true' : 'false'}" data-payment-mode="split">Разделить</button>
    </div>
    <div data-payment-mode-host>${initialMarkup}</div>
  </div>`;
}

function rowValues(row) {
  const priceInput = row.querySelector('[data-payment-price]');
  const percentInput = row.querySelector('input[data-payment-discount-percent]');
  const moneyInput = row.querySelector('[data-payment-discount-money]');
  return { priceInput, percentInput, moneyInput, price: Math.max(0, numberValue(priceInput?.value)), percent: Math.max(0, numberValue(percentInput?.value)), money: Math.max(0, numberValue(moneyInput?.value)) };
}

function setPercentDisplay(input, value) {
  if (!input) return;
  const percent = percentText(value);
  input.value = percent;
  const trigger = input.closest('.ui-select')?.querySelector('[data-ui-select-trigger] .ui-select__value');
  if (trigger) trigger.textContent = percent ? `${percent}%` : '—';
}

function recalculateTotal(root) {
  const total = [...root.querySelectorAll('[data-payment-procedure]')].reduce((sum, row) => {
    const { price, money } = rowValues(row);
    return sum + Math.max(0, price - Math.min(money, price));
  }, 0);
  const totalInput = root.querySelector('[data-payment-total]');
  if (totalInput) totalInput.value = moneyText(total);
}

function collectPaymentItems(root) {
  return [...root.querySelectorAll('[data-payment-procedure]')].map((row) => {
    const values = rowValues(row);
    return { sourceId: row.dataset.paymentSourceId || '', name: row.dataset.paymentName || '', price: values.price, discountPercent: values.percent, discountMoney: Math.min(values.money, values.price) };
  });
}

export function initPaymentForm(root, { onPay = () => {} } = {}) {
  if (!root) return;
  root.querySelectorAll('[data-payment-procedure]').forEach((row) => {
    const { priceInput, percentInput, moneyInput } = rowValues(row);
    priceInput?.addEventListener('input', () => {
      const values = rowValues(row);
      if (values.percent > 0) {
        const discount = Math.min(values.price, values.price * Math.min(values.percent, 100) / 100);
        if (moneyInput) moneyInput.value = moneyText(discount);
      } else if (values.money > values.price && moneyInput) moneyInput.value = moneyText(values.price);
      recalculateTotal(root);
    });
    percentInput?.addEventListener('change', () => {
      const values = rowValues(row);
      const percent = Math.min(values.percent, 100);
      const discount = values.price * percent / 100;
      if (moneyInput) moneyInput.value = percent ? moneyText(discount) : '';
      recalculateTotal(root);
    });
    moneyInput?.addEventListener('input', () => {
      const values = rowValues(row);
      const discount = Math.min(values.money, values.price);
      if (values.money !== discount) moneyInput.value = moneyText(discount);
      setPercentDisplay(percentInput, values.price > 0 ? discount / values.price * 100 : 0);
      recalculateTotal(root);
    });
  });
  root.querySelector('[data-payment-submit]')?.addEventListener('click', () => onPay?.({ total: numberValue(root.querySelector('[data-payment-total]')?.value), items: collectPaymentItems(root) }));
  recalculateTotal(root);
}

export function initPaymentMethods(root, { onWallet = () => {}, onSplit = () => {} } = {}) {
  if (!root) return;
  const host = root.querySelector('[data-payment-mode-host]');
  const total = Math.max(0, numberValue(root.dataset.paymentTotal));
  let wallets = [];
  let initialAllocations = [];
  try { wallets = JSON.parse(root.dataset.paymentWallets || '[]'); } catch { wallets = []; }
  try { initialAllocations = JSON.parse(root.dataset.paymentInitialAllocations || '[]'); } catch { initialAllocations = []; }

  const renderMode = (mode, preserveInitial = false) => {
    if (!host) return;
    const splitMode = mode === 'split';
    root.querySelectorAll('[data-payment-mode]').forEach((node) => {
      const active = (node.dataset.paymentMode === 'split') === splitMode;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    const allocations = preserveInitial ? initialAllocations : [];
    host.innerHTML = splitMode
      ? splitPaymentMarkup({ wallets, total, initialAllocations: allocations })
      : singlePaymentMarkup({ wallets, total, initialWalletId: allocations[0]?.walletId || '' });
    if (splitMode) initSplitPayment(host, { wallets, total, onPay: onSplit });
    else initSinglePayment(host, { wallets, onPay: onWallet });
  };

  root.querySelectorAll('[data-payment-mode]').forEach((node) => node.addEventListener('click', () => renderMode(node.dataset.paymentMode === 'split' ? 'split' : 'single')));
  const initialMode = root.dataset.paymentInitialMode === 'split' ? 'split' : 'single';
  if (initialMode === 'split') initSplitPayment(host, { wallets, total, onPay: onSplit });
  else initSinglePayment(host, { wallets, onPay: onWallet });
}
