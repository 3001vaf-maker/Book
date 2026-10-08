import { button } from '../buttons/index.js';
import { miniCard } from '../cards/mini-card.js';
import { select } from '../selectors/index.js';
import { field } from '../inputs/index.js';
import { escapeHtml } from '../utils/escape-html.js';
import { v2ZBodySections } from '../v2/z-layout.js';
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

function paymentSummary({ workplace = '', date = '', time = '', person = {}, total = 0 } = {}) {
  const identity = [person?.uei, person?.name]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  return `<div class="payment-summary-mini-card-wrap">${miniCard({
    className: 'payment-summary-mini-card',
    lines: [
      { value: workplace || '—', strong: true },
      { value: date || '—' },
      { value: time || '—', align: 'right' },
      { value: identity || '—', strong: true },
      { value: 'К оплате', strong: true },
      { value: moneyDisplay(total), align: 'right', strong: true },
    ],
  })}</div>`;
}

function paymentItemHeader(name = '') {
  const value = String(name || '');
  return `<div class="payment-item-head">
    <strong class="payment-item-head__name">${escapeHtml(value)}</strong>
    <button type="button" class="payment-item-head__remove" data-payment-remove aria-label="Удалить ${escapeHtml(value)}">×</button>
  </div>`;
}

function paymentProcedureBlock(procedure, index) {
  const price = Math.max(0, numberValue(procedure?.cost));
  const percent = Math.max(0, Math.min(100, numberValue(procedure?.discountPercent)));
  const money = Math.max(0, numberValue(procedure?.discountMoney));
  const explicitMode = procedure?.discountMode;
  const mode = explicitMode === 'percent' || explicitMode === 'money' || explicitMode === 'none'
    ? explicitMode
    : percent ? 'percent' : money ? 'money' : 'none';
  const itemName = procedure?.name || '';
  return `<div class="payment-item-section" data-payment-procedure="${index}" data-payment-source-type="${escapeHtml(procedure?.sourceType || 'procedure')}" data-payment-source-id="${escapeHtml(procedure?.id || '')}" data-payment-name="${escapeHtml(itemName)}" data-payment-discount-mode="${mode}">
    ${paymentItemHeader(itemName)}
    <div class="payment-edit-grid">
      ${field({ label: 'Цена', value: moneyText(price), type: 'number', inputmode: 'decimal', min: 0, step: '0.01', data: 'data-payment-price' })}
      ${select({ label: 'Скидка %', value: percent ? percentText(percent) : '', options: discountOptions, className: 'ui-select--center', data: 'data-payment-discount-percent', aria: 'Скидка в процентах' })}
      ${field({ label: 'Скидка ₽', value: money ? moneyText(money) : '', type: 'number', inputmode: 'decimal', min: 0, step: '0.01', data: 'data-payment-discount-money' })}
    </div>
  </div>`;
}

export function paymentForm({
  workplace = '',
  date = '',
  time = '',
  person = {},
  procedures = [],
  total = 0,
  showActions = true,
} = {}) {
  const procedureBlocks = (Array.isArray(procedures) ? procedures : [])
    .map((procedure, index) => paymentProcedureBlock(procedure, index));
  const sections = [
    {
      kind: 'content',
      content: `<div data-payment-summary>${paymentSummary({ workplace, date, time, person, total })}</div>`,
    },
    ...procedureBlocks.map((content) => ({ kind: 'content', content })),
  ];

  return `<div data-payment-ui
    data-payment-workplace="${escapeHtml(workplace)}"
    data-payment-date="${escapeHtml(date)}"
    data-payment-time="${escapeHtml(time)}"
    data-payment-uei="${escapeHtml(person?.uei || '')}"
    data-payment-person-name="${escapeHtml(person?.name || '')}">
    <div data-payment-sections>${v2ZBodySections(sections)}</div>
    ${showActions ? `<div class="modal-actions">${button('Сохранить', { data: 'data-payment-save', variant: 'secondary' })}${button('Оплатить', { data: 'data-payment-submit' })}</div>` : ''}
  </div>`;
}

export function paymentMethods({
  wallets = [],
  total = 0,
  showAction = true,
  showTotal = true,
  initialAllocations = [],
  bonusAvailable = 0,
  initialBonusAmount = 0,
} = {}) {
  const walletData = escapeHtml(JSON.stringify(Array.isArray(wallets) ? wallets.map((wallet) => ({ id: String(wallet?.id || ''), name: String(wallet?.name || '') })) : []));
  return `<div data-payment-methods
    data-payment-total="${escapeHtml(moneyText(total))}"
    data-payment-wallets="${walletData}"
    data-payment-bonus-available="${escapeHtml(moneyText(bonusAvailable))}">
    ${paymentMethodsMarkup({ wallets, total, showAction, showTotal, initialAllocations, bonusAvailable, initialBonusAmount })}
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

function settlementInputs(root) {
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

function applySettlement(root, settlement = null, { preserve = null, paidTotal = 0 } = {}) {
  const items = Array.isArray(settlement?.items) ? settlement.items : [];
  [...root.querySelectorAll('[data-payment-procedure]')].forEach((row, index) => {
    const item = items[index];
    if (!item) return;
    row.dataset.paymentDiscountMode = item.discountMode || 'none';
    const { priceInput, percentInput, moneyInput } = rowValues(row);
    if (priceInput && priceInput !== preserve) priceInput.value = moneyText(item.price);
    if (percentInput !== preserve) setPercentDisplay(percentInput, item.discountPercent || 0);
    if (moneyInput && moneyInput !== preserve) moneyInput.value = item.discountMoney ? moneyText(item.discountMoney) : '';
  });
  const summary = root.querySelector('[data-payment-summary]');
  if (summary) {
    summary.innerHTML = paymentSummary({
      workplace: root.dataset.paymentWorkplace || '',
      date: root.dataset.paymentDate || '',
      time: root.dataset.paymentTime || '',
      person: {
        uei: root.dataset.paymentUei || '',
        name: root.dataset.paymentPersonName || '',
      },
      total: Math.max(0, numberValue(settlement?.planTotal) - Math.max(0, numberValue(paidTotal))),
    });
  }
}

function recalculate(root, calculate, { preserve = null, paidTotal = 0 } = {}) {
  if (typeof calculate !== 'function') return null;
  const settlement = calculate(settlementInputs(root));
  applySettlement(root, settlement, { preserve, paidTotal });
  return settlement;
}

export function initPaymentForm(root, {
  calculate = null,
  paidTotal = 0,
  onSave = () => {},
  onPay = () => {},
  onRemove = () => {},
  onChange = () => {},
} = {}) {
  if (!root) return null;
  const initialSettlement = recalculate(root, calculate, { paidTotal });
  let baseline = JSON.stringify(settlementInputs(root));

  const currentState = (preserve = null) => {
    const settlement = recalculate(root, calculate, { preserve, paidTotal });
    const dirty = JSON.stringify(settlementInputs(root)) !== baseline;
    const result = {
      settlement,
      items: settlement?.items || [],
      total: Math.max(0, numberValue(settlement?.planTotal) - Math.max(0, numberValue(paidTotal))),
      dirty,
    };
    onChange?.(result);
    return result;
  };

  root.querySelectorAll('[data-payment-procedure]').forEach((row) => {
    const { priceInput, percentInput, moneyInput } = rowValues(row);
    priceInput?.addEventListener('input', () => currentState(priceInput));
    percentInput?.addEventListener('change', () => {
      row.dataset.paymentDiscountMode = percentInput.value ? 'percent' : 'none';
      currentState(percentInput);
    });
    moneyInput?.addEventListener('input', () => {
      row.dataset.paymentDiscountMode = moneyInput.value ? 'money' : 'none';
      currentState(moneyInput);
    });
  });

  root.querySelectorAll('[data-payment-remove]').forEach((remove) => remove.addEventListener('click', () => {
    const row = remove.closest('[data-payment-procedure]');
    if (!row) return;
    const removed = {
      sourceType: row.dataset.paymentSourceType || 'procedure',
      sourceId: row.dataset.paymentSourceId || '',
      name: row.dataset.paymentName || '',
    };
    row.remove();
    const result = currentState();
    onRemove?.({ ...removed, ...result });
  }));

  root.querySelector('[data-payment-save]')?.addEventListener('click', () => {
    const result = currentState();
    if (!result.settlement) return;
    baseline = JSON.stringify(settlementInputs(root));
    onSave?.(result);
  });
  root.querySelector('[data-payment-submit]')?.addEventListener('click', () => {
    const result = currentState();
    if (!result.settlement) return;
    onPay?.(result);
  });

  onChange?.({
    settlement: initialSettlement,
    items: initialSettlement?.items || [],
    total: Math.max(0, numberValue(initialSettlement?.planTotal) - Math.max(0, numberValue(paidTotal))),
    dirty: false,
  });

  return {
    read: () => currentState(),
    markSaved: () => { baseline = JSON.stringify(settlementInputs(root)); },
  };
}

export function initPaymentMethods(root, { onPay = () => {}, onChange = () => {} } = {}) {
  if (!root) return null;
  const total = Math.max(0, numberValue(root.dataset.paymentTotal));
  const bonusAvailable = Math.max(0, numberValue(root.dataset.paymentBonusAvailable));
  let wallets = [];
  try { wallets = JSON.parse(root.dataset.paymentWallets || '[]'); } catch { wallets = []; }
  return initPaymentMethodsAllocation(root, { wallets, total, bonusAvailable, onPay, onChange });
}
