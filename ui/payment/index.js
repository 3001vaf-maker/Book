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
    <section class="payment-procedure" data-payment-procedure="${index}">
      <strong class="payment-procedure__name">${escapeHtml(procedure?.name || '')}</strong>
      <div class="payment-fields payment-fields--three">
        <label><span>Цена</span><input type="number" inputmode="decimal" step="0.01" min="0" value="${escapeHtml(moneyText(procedure?.cost))}" data-payment-price></label>
        <div class="payment-discount-percent">${select({
          label: 'Скидка %',
          value: '',
          options: discountOptions,
          data: 'data-payment-discount-percent',
          aria: 'Скидка в процентах',
        })}</div>
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

function recalculateTotal(root) {
  const total = [...root.querySelectorAll('[data-payment-procedure]')].reduce((sum, row) => {
    const { price, money } = rowValues(row);
    return sum + Math.max(0, price - Math.min(money, price));
  }, 0);
  const totalInput = root.querySelector('[data-payment-total]');
  if (totalInput) totalInput.value = moneyText(total);
}

export function initPaymentForm(root) {
  if (!root) return;

  root.querySelectorAll('[data-payment-procedure]').forEach((row) => {
    const { priceInput, percentInput, moneyInput } = rowValues(row);

    priceInput?.addEventListener('input', () => {
      const values = rowValues(row);
      if (values.percent > 0) {
        const discount = Math.min(values.price, values.price * Math.min(values.percent, 100) / 100);
        if (moneyInput) moneyInput.value = moneyText(discount);
      } else if (values.money > values.price && moneyInput) {
        moneyInput.value = moneyText(values.price);
      }
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
      const percent = values.price > 0 ? discount / values.price * 100 : 0;
      setPercentDisplay(percentInput, percent);
      recalculateTotal(root);
    });
  });

  recalculateTotal(root);
}
