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

function walletOptions(wallets = []) {
  return [{ value: '', label: 'Кошелёк' }, ...(Array.isArray(wallets) ? wallets : []).map((wallet) => ({
    value: wallet?.id || '',
    label: wallet?.name || 'Кошелёк',
  }))];
}

function walletName(wallets, id) {
  return (Array.isArray(wallets) ? wallets : []).find((wallet) => String(wallet?.id || '') === String(id || ''))?.name || '';
}

function amountDisplay(value, data = '') {
  return `<div class="payment-methods__amount" ${data}><span>Сумма</span><strong>${escapeHtml(moneyText(value))} ₽</strong></div>`;
}

function splitPart(index, wallets, { hidden = false } = {}) {
  return `<div class="payment-split-part" data-payment-split-part="${index}"${hidden ? ' hidden' : ''}>
    ${select({ value: '', options: walletOptions(wallets), data: `data-payment-split-wallet="${index}"`, aria: `Кошелёк части ${index + 1}` })}
    <input class="payment-split-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Сумма" data-payment-split-amount="${index}">
  </div>`;
}

export function paymentMethods({ wallets = [], total = 0 } = {}) {
  return `<div class="payment-methods" data-payment-methods data-payment-total="${escapeHtml(moneyText(total))}">
    <div class="segment-control segment-control--two-equal" role="group" aria-label="Режим оплаты">
      <button type="button" class="is-active" aria-pressed="true" data-payment-mode="single">Оплата</button>
      <button type="button" aria-pressed="false" data-payment-mode="split">Разделить</button>
    </div>
    <div class="payment-methods__single" data-payment-single>
      ${amountDisplay(total)}
      ${select({ value: '', options: walletOptions(wallets), data: 'data-payment-single-wallet', aria: 'Кошелёк оплаты' })}
      ${button('Подтвердить оплату', { data: 'data-payment-single-submit disabled' })}
    </div>
    <div class="payment-methods__split" data-payment-split hidden>
      ${amountDisplay(total, 'data-payment-split-remaining')}
      ${splitPart(0, wallets)}
      ${splitPart(1, wallets)}
      ${splitPart(2, wallets, { hidden: true })}
      ${button('Подтвердить оплату', { data: 'data-payment-split-submit disabled' })}
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

export function initPaymentMethods(root, { onWallet = () => {}, onSplit = () => {} } = {}) {
  if (!root) return;
  const single = root.querySelector('[data-payment-single]');
  const split = root.querySelector('[data-payment-split]');
  const total = Math.max(0, numberValue(root.dataset.paymentTotal));
  const wallets = walletOptions([]).length ? [] : [];
  const catalog = [...root.querySelectorAll('[data-payment-single-wallet], [data-payment-split-wallet]')]
    .flatMap((input) => {
      try {
        const trigger = input.closest('.ui-select')?.querySelector('[data-ui-select-trigger]');
        return JSON.parse(trigger?.dataset.options || '[]');
      } catch {
        return [];
      }
    })
    .filter((item) => item?.value)
    .reduce((map, item) => map.set(String(item.value), String(item.label || '')), new Map());

  const singleWallet = root.querySelector('input[data-payment-single-wallet]');
  const singleSubmit = root.querySelector('[data-payment-single-submit]');
  const syncSingle = () => {
    if (singleSubmit) singleSubmit.disabled = !singleWallet?.value;
  };
  singleWallet?.addEventListener('change', syncSingle);
  singleSubmit?.addEventListener('click', () => {
    const id = singleWallet?.value || '';
    if (!id) return;
    onWallet?.({ id, name: catalog.get(String(id)) || '' });
  });
  syncSingle();

  const splitParts = [...root.querySelectorAll('[data-payment-split-part]')];
  const splitRemaining = root.querySelector('[data-payment-split-remaining]');
  const splitSubmit = root.querySelector('[data-payment-split-submit]');
  const thirdPart = root.querySelector('[data-payment-split-part="2"]');

  const splitValues = () => splitParts.map((part) => ({
    part,
    walletInput: part.querySelector('input[data-payment-split-wallet]'),
    amountInput: part.querySelector('[data-payment-split-amount]'),
  }));

  const recalcSplit = () => {
    const values = splitValues();
    const first = Math.max(0, numberValue(values[0]?.amountInput?.value));
    const second = Math.max(0, numberValue(values[1]?.amountInput?.value));
    const firstTwo = first + second;
    const showThird = first > 0 && second > 0 && firstTwo < total - 0.009;
    if (thirdPart) {
      thirdPart.hidden = !showThird;
      if (!showThird) {
        const thirdAmount = values[2]?.amountInput;
        const thirdWallet = values[2]?.walletInput;
        if (thirdAmount) thirdAmount.value = '';
        if (thirdWallet) {
          thirdWallet.value = '';
          const valueNode = thirdWallet.closest('.ui-select')?.querySelector('.ui-select__value');
          if (valueNode) valueNode.textContent = 'Кошелёк';
        }
      }
    }
    const visibleValues = splitValues().filter(({ part }) => !part.hidden);
    const used = visibleValues.reduce((sum, { amountInput }) => sum + Math.max(0, numberValue(amountInput?.value)), 0);
    const remaining = Math.max(0, total - used);
    if (splitRemaining) splitRemaining.innerHTML = `<span>Сумма</span><strong>${escapeHtml(moneyText(remaining))} ₽</strong>`;
    const complete = Math.abs(used - total) <= 0.009
      && visibleValues.filter(({ amountInput }) => numberValue(amountInput?.value) > 0).every(({ walletInput }) => Boolean(walletInput?.value));
    if (splitSubmit) splitSubmit.disabled = !complete;
  };

  splitValues().forEach(({ walletInput, amountInput }) => {
    walletInput?.addEventListener('change', recalcSplit);
    amountInput?.addEventListener('input', recalcSplit);
  });
  splitSubmit?.addEventListener('click', () => {
    const allocations = splitValues()
      .filter(({ part }) => !part.hidden)
      .map(({ walletInput, amountInput }) => ({
        walletId: walletInput?.value || '',
        walletName: catalog.get(String(walletInput?.value || '')) || '',
        amount: Math.max(0, numberValue(amountInput?.value)),
      }))
      .filter((item) => item.amount > 0);
    const used = allocations.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(used - total) > 0.009 || allocations.some((item) => !item.walletId)) return;
    onSplit?.(allocations);
  });

  root.querySelectorAll('[data-payment-mode]').forEach((buttonNode) => buttonNode.addEventListener('click', () => {
    const mode = buttonNode.dataset.paymentMode === 'split' ? 'split' : 'single';
    root.querySelectorAll('[data-payment-mode]').forEach((node) => {
      const active = node.dataset.paymentMode === mode;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    if (single) single.hidden = mode !== 'single';
    if (split) split.hidden = mode !== 'split';
    if (mode === 'split') recalcSplit();
  }));

  recalcSplit();
}
