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
    const money = Math.max(0, numberValue(procedure?.discountMoney));
    const explicitMode = procedure?.discountMode;
    const mode = explicitMode === 'percent' || explicitMode === 'money' || explicitMode === 'none'
      ? explicitMode
      : percent ? 'percent' : money ? 'money' : 'none';
    return `
    <section class="payment-procedure" data-payment-procedure="${index}" data-payment-source-type="${escapeHtml(procedure?.sourceType || 'procedure')}" data-payment-source-id="${escapeHtml(procedure?.id || '')}" data-payment-name="${escapeHtml(procedure?.name || '')}" data-payment-discount-mode="${mode}">
      <strong class="payment-procedure__name">${escapeHtml(procedure?.name || '')}</strong>
      <div class="payment-fields payment-fields--three">
        <label><span>Цена</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(moneyText(price))}" data-payment-price></label>
        <div class="payment-discount-percent">${select({ label: 'Скидка %', value: percent ? percentText(percent) : '', options: discountOptions, data: 'data-payment-discount-percent', aria: 'Скидка в процентах' })}</div>
        <label><span>Скидка ₽</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${money ? escapeHtml(moneyText(money)) : ''}" data-payment-discount-money></label>
      </div>
    </section>`;
  }).join('');

  const uei = client?.uei ? `<span class="payment-client-uei">${escapeHtml(client.uei)}</span>` : '';
  const name = escapeHtml(client?.name || '');

  return `<div class="payment-ui" data-payment-ui>
    <div class="payment-readonly-block"><strong>${escapeHtml(workplace)}</strong></div>
    <div class="payment-readonly-block"><span>${escapeHtml(date)}</span><span>${escapeHtml(time)}</span></div>
    <div class="payment-readonly-block payment-readonly-block--client">${uei}<strong>${name}</strong></div>
    <div class="payment-procedures">${procedureBlocks}</div>
    <label class="payment-total"><span>Итого</span><input type="number" inputmode="decimal" value="${escapeHtml(moneyText(total))}" data-payment-total readonly></label>
    <div class="payment-actions">${button('Сохранить', { data: 'data-payment-save', variant: 'secondary' })}${button('Оплатить', { data: 'data-payment-submit' })}</div>
  </div>`;
}

export function paymentMethods({ wallets = [], total = 0 } = {}) {
  const walletData = escapeHtml(JSON.stringify(Array.isArray(wallets) ? wallets.map((wallet) => ({ id: String(wallet?.id || ''), name: String(wallet?.name || '') })) : []));
  return `<div class="payment-methods" data-payment-methods data-payment-total="${escapeHtml(moneyText(total))}" data-payment-wallets="${walletData}">
    <div class="segment-control segment-control--two-equal" role="group" aria-label="Режим оплаты">
      <button type="button" class="is-active" aria-pressed="true" data-payment-mode="single">Оплата</button>
      <button type="button" aria-pressed="false" data-payment-mode="split">Разделить</button>
    </div>
    <div data-payment-mode-host>${singlePaymentMarkup({ wallets, total })}</div>
  </div>`;
}

function rowValues(row) {
  const priceInput = row.querySelector('[data-payment-price]');
  const percentInput = row.querySelector('input[data-payment-discount-percent]');
  const moneyInput = row.querySelector('[data-payment-discount-money]');
  return {
    priceInput,
    percentInput,
    moneyInput,
    price: Math.max(0, numberValue(priceInput?.value)),
    percent: Math.max(0, numberValue(percentInput?.value)),
    money: Math.max(0, numberValue(moneyInput?.value)),
  };
}

function setPercentDisplay(input, value) {
  if (!input) return;
  const percent = percentText(value);
  input.value = percent;
  const trigger = input.closest('.ui-select')?.querySelector('[data-ui-select-trigger] .ui-select__value');
  if (trigger) trigger.textContent = percent ? `${percent}%` : '—';
}

function financialInputs(root) {
  return [...root.querySelectorAll('[data-payment-procedure]')].map((row) => {
    const values = rowValues(row);
    const mode = row.dataset.paymentDiscountMode || 'none';
    return {
      sourceType: row.dataset.paymentSourceType || 'procedure',
      sourceId: row.dataset.paymentSourceId || '',
      name: row.dataset.paymentName || '',
      price: values.price,
      discountMode: mode,
      discountPercent: mode === 'percent' ? values.percent : '',
      discountMoney: mode === 'money' ? values.money : '',
    };
  });
}

function applyFinancialPlan(root, plan = null) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  [...root.querySelectorAll('[data-payment-procedure]')].forEach((row, index) => {
    const item = items[index];
    if (!item) return;
    row.dataset.paymentDiscountMode = item.discountMode || 'none';
    const { priceInput, percentInput, moneyInput } = rowValues(row);
    if (priceInput) priceInput.value = moneyText(item.price);
    setPercentDisplay(percentInput, item.discountPercent || 0);
    if (moneyInput) moneyInput.value = item.discountMoney ? moneyText(item.discountMoney) : '';
  });
  const totalInput = root.querySelector('[data-payment-total]');
  if (totalInput) totalInput.value = moneyText(plan?.planTotal || 0);
}

function recalculate(root, calculate) {
  if (typeof calculate !== 'function') return null;
  const plan = calculate(financialInputs(root));
  applyFinancialPlan(root, plan);
  return plan;
}

export function initPaymentForm(root, { calculate = null, onSave = () => {}, onPay = () => {} } = {}) {
  if (!root) return;
  root.querySelectorAll('[data-payment-procedure]').forEach((row) => {
    const { priceInput, percentInput, moneyInput } = rowValues(row);
    priceInput?.addEventListener('input', () => recalculate(root, calculate));
    percentInput?.addEventListener('change', () => {
      row.dataset.paymentDiscountMode = percentInput.value ? 'percent' : 'none';
      recalculate(root, calculate);
    });
    moneyInput?.addEventListener('input', () => {
      row.dataset.paymentDiscountMode = moneyInput.value ? 'money' : 'none';
      recalculate(root, calculate);
    });
  });
  root.querySelector('[data-payment-save]')?.addEventListener('click', () => {
    const plan = recalculate(root, calculate);
    if (!plan) return;
    onSave?.({ finance: plan, items: plan.items, total: plan.planTotal });
  });
  root.querySelector('[data-payment-submit]')?.addEventListener('click', () => {
    const plan = recalculate(root, calculate);
    if (!plan) return;
    onPay?.({ finance: plan, items: plan.items, total: plan.planTotal });
  });
  recalculate(root, calculate);
}

export function initPaymentMethods(root, { onWallet = () => {}, onSplit = () => {} } = {}) {
  if (!root) return;
  const host = root.querySelector('[data-payment-mode-host]');
  const total = Math.max(0, numberValue(root.dataset.paymentTotal));
  let wallets = [];
  try { wallets = JSON.parse(root.dataset.paymentWallets || '[]'); } catch { wallets = []; }

  const renderMode = (mode) => {
    if (!host) return;
    const splitMode = mode === 'split';
    root.querySelectorAll('[data-payment-mode]').forEach((node) => {
      const active = (node.dataset.paymentMode === 'split') === splitMode;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    host.innerHTML = splitMode
      ? splitPaymentMarkup({ wallets, total })
      : singlePaymentMarkup({ wallets, total });
    if (splitMode) initSplitPayment(host, { wallets, total, onPay: onSplit });
    else initSinglePayment(host, { wallets, onPay: onWallet });
  };

  root.querySelectorAll('[data-payment-mode]').forEach((node) => node.addEventListener('click', () => renderMode(node.dataset.paymentMode === 'split' ? 'split' : 'single')));
  initSinglePayment(host, { wallets, onPay: onWallet });
}