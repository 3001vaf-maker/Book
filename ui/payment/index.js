import { button, iconButton } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';
import { paymentMethodsMarkup, initPaymentMethodsAllocation } from './methods.js';

const numberValue = (value) => {
  const number = Number(String(value ?? '').replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
};

const moneyText = (value) => {
  const number = numberValue(value);
  return String(Math.round(number * 100) / 100);
};

const moneyDisplay = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Math.max(0, numberValue(value))).replaceAll('\u00a0', ' ')} ₽`;

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
    const itemName = procedure?.name || '';
    return `
    <section class="payment-procedure" data-payment-procedure="${index}" data-payment-source-type="${escapeHtml(procedure?.sourceType || 'procedure')}" data-payment-source-id="${escapeHtml(procedure?.id || '')}" data-payment-name="${escapeHtml(itemName)}" data-payment-discount-mode="${mode}">
      <div class="payment-procedure__head">
        <strong class="payment-procedure__name">${escapeHtml(itemName)}</strong>
        ${iconButton('×', { className: 'remove-button payment-procedure__remove', data: 'data-payment-remove', aria: `Удалить ${itemName}` })}
      </div>
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
    <div class="payment-total"><span>Итого</span><strong data-payment-total>${escapeHtml(moneyDisplay(total))}</strong></div>
    <div class="payment-actions">${button('Сохранить', { data: 'data-payment-save', variant: 'secondary' })}${button('Оплатить', { data: 'data-payment-submit' })}</div>
  </div>`;
}

export function paymentMethods({ wallets = [], total = 0 } = {}) {
  const walletData = escapeHtml(JSON.stringify(Array.isArray(wallets) ? wallets.map((wallet) => ({ id: String(wallet?.id || ''), name: String(wallet?.name || '') })) : []));
  return `<div class="payment-methods" data-payment-methods data-payment-total="${escapeHtml(moneyText(total))}" data-payment-wallets="${walletData}">${paymentMethodsMarkup({ wallets, total })}</div>`;
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

function applyFinancialPlan(root, plan = null, { preserve = null } = {}) {
  const items = Array.isArray(plan?.items) ? plan.items : [];
  [...root.querySelectorAll('[data-payment-procedure]')].forEach((row, index) => {
    const item = items[index];
    if (!item) return;
    row.dataset.paymentDiscountMode = item.discountMode || 'none';
    const { priceInput, percentInput, moneyInput } = rowValues(row);
    if (priceInput && priceInput !== preserve) priceInput.value = moneyText(item.price);
    if (percentInput !== preserve) setPercentDisplay(percentInput, item.discountPercent || 0);
    if (moneyInput && moneyInput !== preserve) moneyInput.value = item.discountMoney ? moneyText(item.discountMoney) : '';
  });
  const totalNode = root.querySelector('[data-payment-total]');
  if (totalNode) totalNode.textContent = moneyDisplay(plan?.planTotal || 0);
}

function recalculate(root, calculate, { preserve = null } = {}) {
  if (typeof calculate !== 'function') return null;
  const plan = calculate(financialInputs(root));
  applyFinancialPlan(root, plan, { preserve });
  return plan;
}

function bindPaymentRow(root, row, calculate) {
  const { priceInput, percentInput, moneyInput } = rowValues(row);
  priceInput?.addEventListener('input', () => recalculate(root, calculate, { preserve: priceInput }));
  percentInput?.addEventListener('change', () => {
    row.dataset.paymentDiscountMode = percentInput.value ? 'percent' : 'none';
    recalculate(root, calculate, { preserve: percentInput });
  });
  moneyInput?.addEventListener('input', () => {
    row.dataset.paymentDiscountMode = moneyInput.value ? 'money' : 'none';
    recalculate(root, calculate, { preserve: moneyInput });
  });
}

export function initPaymentForm(root, { calculate = null, onSave = () => {}, onPay = () => {}, onRemove = () => {} } = {}) {
  if (!root) return;
  root.querySelectorAll('[data-payment-procedure]').forEach((row) => bindPaymentRow(root, row, calculate));
  root.querySelectorAll('[data-payment-remove]').forEach((remove) => remove.addEventListener('click', () => {
    const row = remove.closest('[data-payment-procedure]');
    if (!row) return;
    const removed = {
      sourceType: row.dataset.paymentSourceType || 'procedure',
      sourceId: row.dataset.paymentSourceId || '',
      name: row.dataset.paymentName || '',
    };
    row.remove();
    const plan = recalculate(root, calculate);
    if (!plan) return;
    onRemove?.({ ...removed, finance: plan, items: plan.items, total: plan.planTotal });
  }));
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

export function initPaymentMethods(root, { onPay = () => {} } = {}) {
  if (!root) return;
  const total = Math.max(0, numberValue(root.dataset.paymentTotal));
  let wallets = [];
  try { wallets = JSON.parse(root.dataset.paymentWallets || '[]'); } catch { wallets = []; }
  initPaymentMethodsAllocation(root, { wallets, total, onPay });
}
