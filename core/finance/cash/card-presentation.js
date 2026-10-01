import { normalizeEntityCardAppearance } from '../../../ui/ui.js';

function money(value = 0) {
  return `${(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
}

function defaultLines(entries = []) {
  const lines = Array.from({ length: 9 }, () => ({
    field: '',
    zone: 'full',
    align: 'left',
    size: 'm',
    color: 'white',
    bold: false,
    italic: false,
    underline: false,
    uppercase: false,
  }));
  entries.forEach(({ row, field, zone = 'full', align = 'left', size = 'm', color = 'white', bold = false }) => {
    const index = Math.max(0, Math.min(8, Number(row) - 1));
    lines[index] = { field, zone, align, size, color, bold, italic: false, underline: false, uppercase: false };
  });
  return lines;
}

function hasConfiguredLines(value = {}) {
  return Array.isArray(value?.lines) && value.lines.some((line) => String(line?.field || '').trim());
}

export function walletCardFields(wallet = {}, balance = 0) {
  return [
    { value: 'walletName', label: 'Наименование', text: String(wallet?.name || '') },
    { value: 'balance', label: 'Сумма', text: money(balance) },
  ];
}

export function walletCardAppearance(wallet = {}) {
  if (hasConfiguredLines(wallet?.cardAppearance)) {
    return normalizeEntityCardAppearance(wallet.cardAppearance);
  }
  return normalizeEntityCardAppearance({
    lines: defaultLines([
      { row: 7, field: 'walletName', zone: 'full', align: 'left', size: 'l', bold: true },
      { row: 9, field: 'balance', zone: 'right', align: 'right', size: 'm', bold: true },
    ]),
  });
}


export function cashEntityCardFields(entity = {}) {
  return [
    { value: 'entityName', label: 'Наименование', text: String(entity?.name || '') },
  ];
}

export function cashEntityCardAppearance(entity = {}) {
  if (hasConfiguredLines(entity?.cardAppearance)) {
    return normalizeEntityCardAppearance(entity.cardAppearance);
  }
  return normalizeEntityCardAppearance({
    lines: defaultLines([
      { row: 7, field: 'entityName', zone: 'full', align: 'left', size: 'l', bold: true },
    ]),
  });
}
