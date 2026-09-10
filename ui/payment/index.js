import { button } from '../buttons/index.js';
import { select } from '../selectors/index.js';
import { escapeHtml } from '../utils/escape-html.js';

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
  const procedureBlocks = (Array.isArray(procedures) ? procedures : []).map((procedure, index) => `
    <section class="payment-procedure" data-payment-procedure="${index}" data-payment-source-id="${escapeHtml(procedure?.id || '')}" data-payment-name="${escapeHtml(procedure?.name || '')}">
      <strong class="payment-procedure__name">${escapeHtml(procedure?.name || '')}</strong>
      <div class="payment-fields payment-fields--three">
        <label><span>Цена</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(moneyText(procedure?.cost))}" data-payment-price></label>
        <div class="payment-discount-percent">${select({ label: 'Скидка %', value: '', options: discountOptions, data: 'data-payment-discount-percent', aria: 'Скидка в процентах' })}</div>
        <label><span>Скидка ₽</span><input type="number" inputmode="decimal" step="0.01" min="0" value="" data-payment-discount-money></label>
      </div>
    </section>`).join('');

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

function walletButtons(wallets = [], dataName = 'data-payment-wallet') {
  return (Array.isArray(wallets) ? wallets : []).map((wallet) => button(
    escapeHtml(wallet?.name || 'Кошелёк'),
    {
      data: `${dataName}="${escapeHtml(wallet?.id || '')}" data-payment-wallet-name="${escapeHtml(wallet?.name || '')}"`,
      variant: 'secondary',
      aria: `Выбрать кошелёк ${wallet?.name || ''}`,
    },
  )).join('');
}

export function paymentMethods({ wallets = [], total = 0 } = {}) {
  return `<div class="payment-methods" data-payment-methods data-payment-total="${escapeHtml(moneyText(total))}">
    <div class="segment-control segment-control--two-equal" role="group" aria-label="Режим оплаты">
      <button type="button" class="is-active" aria-pressed="true" data-payment-mode="single">Полностью</button>
      <button type="button" aria-pressed="false" data-payment-mode="split">Разделить</button>
    </div>
    <div class="payment-methods__single" data-payment-single>
      <div class="payment-methods__wallets" data-payment-wallets>${walletButtons(wallets)}</div>
      <div class="payment-methods__confirm">${button('Оплатить', { data: 'data-payment-single-submit' })}</div>
    </div>
    <div class="payment-methods__split" data-payment-split hidden>
      <div data-payment-split-history></div>
      <div data-payment-split-current></div>
    </div>
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

function setSelectedWallet(container, selector, selectedId) {
  container?.querySelectorAll(selector).forEach((node) => {
    const active = String(node.getAttribute(selector.slice(1, -1)) || '') === String(selectedId || '');
    node.classList.toggle('is-selected', active);
    node.setAttribute('aria-pressed', String(active));
  });
}

export function initPaymentMethods(root, { onWallet = () => {}, onSplit = () => {} } = {}) {
  if (!root) return;
  const single = root.querySelector('[data-payment-single]');
  const split = root.querySelector('[data-payment-split]');
  const total = Math.max(0, numberValue(root.dataset.paymentTotal));
  const wallets = [...root.querySelectorAll('[data-payment-wallet]')].map((node) => ({ id: node.dataset.paymentWallet || '', name: node.dataset.paymentWalletName || '' }));
  let selectedSingle = null;
  const allocations = [];

  const renderSplitHistory = () => {
    const host = root.querySelector('[data-payment-split-history]');
    if (!host) return;
    host.innerHTML = allocations.length ? `<div class="payment-split-history">${allocations.map((item) => `<div><span>${escapeHtml(item.walletName)}</span><strong>${escapeHtml(moneyText(item.amount))} ₽</strong></div>`).join('')}</div>` : '';
  };

  const renderSplitStep = () => {
    const host = root.querySelector('[data-payment-split-current]');
    if (!host) return;
    const used = allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const remaining = Math.max(0, total - used);
    if (!remaining) {
      onSplit?.([...allocations]);
      return;
    }
    host.innerHTML = `<div class="payment-split-step">
      <label class="payment-split-amount"><span>Сумма</span><input type="number" min="0.01" max="${escapeHtml(moneyText(remaining))}" step="0.01" inputmode="decimal" value="${escapeHtml(moneyText(remaining))}" data-payment-split-amount></label>
      <div class="payment-methods__wallets" data-payment-split-wallets>${walletButtons(wallets, 'data-payment-split-wallet')}</div>
      <div class="payment-methods__confirm">${button('Оплатить', { data: 'data-payment-split-submit' })}</div>
    </div>`;
    let selectedSplit = null;
    host.querySelectorAll('[data-payment-split-wallet]').forEach((node) => node.addEventListener('click', () => {
      selectedSplit = { id: node.dataset.paymentSplitWallet || '', name: node.dataset.paymentWalletName || '' };
      host.querySelectorAll('[data-payment-split-wallet]').forEach((item) => {
        const active = item === node;
        item.classList.toggle('is-selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
    }));
    host.querySelector('[data-payment-split-submit]')?.addEventListener('click', () => {
      if (!selectedSplit?.id) return;
      const input = host.querySelector('[data-payment-split-amount]');
      const amount = Math.max(0, numberValue(input?.value));
      if (!amount || amount > remaining + 0.009) return;
      allocations.push({ walletId: selectedSplit.id, walletName: selectedSplit.name, amount });
      renderSplitHistory();
      renderSplitStep();
    });
  };

  root.querySelectorAll('[data-payment-mode]').forEach((buttonNode) => buttonNode.addEventListener('click', () => {
    const mode = buttonNode.dataset.paymentMode === 'split' ? 'split' : 'single';
    root.querySelectorAll('[data-payment-mode]').forEach((node) => {
      const active = node.dataset.paymentMode === mode;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    if (single) single.hidden = mode !== 'single';
    if (split) split.hidden = mode !== 'split';
    if (mode === 'split') {
      allocations.length = 0;
      renderSplitHistory();
      renderSplitStep();
    }
  }));

  root.querySelectorAll('[data-payment-wallet]').forEach((node) => node.addEventListener('click', () => {
    selectedSingle = { id: node.dataset.paymentWallet || '', name: node.dataset.paymentWalletName || '' };
    root.querySelectorAll('[data-payment-wallet]').forEach((item) => {
      const active = item === node;
      item.classList.toggle('is-selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }));
  root.querySelector('[data-payment-single-submit]')?.addEventListener('click', () => {
    if (selectedSingle?.id) onWallet?.(selectedSingle);
  });
}
