import {
  button,
  emptyState,
  field,
  modal,
  mountModal,
  mountV2ZLayer,
  openNotice,
  searchableSelect,
  select,
  shortDateTimeParts,
  twoColumnLayout,
  v2ListEntries,
  v2ListEntry,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { escapeHtml } from '../../ui/utils/escape-html.js';
import {
  getInventoryItem,
  getInventoryItems,
  getInventoryMovement,
  getInventoryMovements,
  inventoryOrderSuggestions,
} from './data.js';
import {
  correctInventoryMovement,
  createInventoryItem,
  createInventoryMovement,
  loadInventory,
  updateInventoryItem,
} from './service.js';

const UNIT_OPTIONS = ['шт.', 'г', 'кг', 'мл', 'л', 'м', 'уп.'].map((value) => ({ value, label: value }));

function numberText(value, maximum = 3) {
  const number = Number(value) || 0;
  return number.toLocaleString('ru-RU', { maximumFractionDigits: maximum }).replaceAll('\u00a0', ' ');
}

function moneyText(value) {
  const number = Number(value) || 0;
  return `${number.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replaceAll('\u00a0', ' ')} ₽`;
}

function movementTitle(movement = {}) {
  if (movement.personUei) return String(movement.personUei);
  if (movement.kind === 'RECEIPT') return 'Приход';
  if (movement.kind === 'CONSUMPTION') return 'Расход';
  if (movement.kind === 'WRITE_OFF') return 'Списание';
  if (movement.kind === 'SALE') return 'Продажа';
  if (movement.kind === 'RETURN') return 'Возврат';
  if (movement.kind === 'ADJUSTMENT') return 'Инвентаризация';
  if (movement.kind === 'CORRECTION') return 'Корректировка';
  return 'Движение';
}

function movementSubtitle(movement = {}) {
  return [movement.procedureKey, movement.note].filter(Boolean).join(' · ');
}

function movementMoment(value) {
  const parts = shortDateTimeParts(value || '');
  return [parts.date, parts.time].filter(Boolean).join(' · ');
}

function movementSign(line = {}) {
  return line.direction === 'OUT' ? '−' : '+';
}

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function context(title, { a = null, c = null } = {}) {
  return workspaceHeaderContext({ title, a, c });
}

function itemOptions() {
  return getInventoryItems().map((item) => ({
    value: item.itemId,
    label: item.name,
    meta: `${numberText(item.balance)} ${item.unit}`,
  }));
}

function itemSummary(item) {
  return `<div class="entity-details entity-details--split">
    <div><span>Остаток</span><strong>${escapeHtml(`${numberText(item.balance)} ${item.unit}`)}</strong></div>
    ${item.lastPurchasePrice == null ? '' : `<div><span>Последняя цена</span><strong>${escapeHtml(moneyText(item.lastPurchasePrice))}</strong></div>`}
    ${item.category ? `<div><span>Категория</span><strong>${escapeHtml(item.category)}</strong></div>` : ''}
    ${item.location ? `<div><span>Место</span><strong>${escapeHtml(item.location)}</strong></div>` : ''}
    ${item.supplier ? `<div><span>Поставщик</span><strong>${escapeHtml(item.supplier)}</strong></div>` : ''}
  </div>`;
}

function advancedItemFields(item = {}) {
  return `
    ${field({ label: 'Категория', name: 'category', value: item.category || '' })}
    ${field({ label: 'Поставщик', name: 'supplier', value: item.supplier || '' })}
    ${field({ label: 'Место хранения', name: 'location', value: item.location || '' })}
    ${field({ label: 'Артикул', name: 'sku', value: item.sku || '' })}
    ${field({ label: 'Штрихкод', name: 'barcode', value: item.barcode || '' })}
    ${twoColumnLayout(
      field({ label: 'Минимум', name: 'minStock', value: item.minStock ?? '', type: 'number', min: '0', step: '0.001', inputmode: 'decimal' }),
      field({ label: 'Цель', name: 'targetStock', value: item.targetStock ?? '', type: 'number', min: '0', step: '0.001', inputmode: 'decimal' }),
      { ariaLabel: 'Правила остатка' },
    )}
    ${field({ label: 'В упаковке', name: 'packageQuantity', value: item.packageQuantity ?? '', type: 'number', min: '0', step: '0.001', inputmode: 'decimal' })}`;
}

function openAdvancedItemModal(trigger, item = {}) {
  const content = `<form id="inventory-advanced-form" data-inventory-advanced-form>
    ${advancedItemFields(item)}
    ${button('Применить', { type: 'submit' })}
  </form>`;
  return mountModal(trigger, modal(content, { title: 'Дополнительно', variant: 'x' }));
}

function collectOptionalNumber(form, name) {
  const raw = String(new FormData(form).get(name) ?? '').trim();
  return raw === '' ? null : Number(raw.replace(',', '.'));
}

function openItemEditor(root, itemId = '') {
  const item = itemId ? getInventoryItem(itemId) : null;
  const creating = !item;
  const markup = `
    ${context(creating ? 'Новая позиция' : item.name, {
      a: { kind: 'settings', data: 'data-inventory-item-advanced', aria: 'Дополнительные настройки позиции' },
      c: { label: 'Сохранить', data: 'data-inventory-item-save', aria: 'Сохранить позицию' },
    })}
    <form data-inventory-item-form>
      ${field({ label: 'Наименование', name: 'name', value: item?.name || '', required: true, autocomplete: 'off' })}
      ${twoColumnLayout(
        select({ label: 'Единица', name: 'unit', value: item?.unit || 'шт.', options: UNIT_OPTIONS }),
        creating
          ? field({ label: 'Количество', name: 'quantity', value: '', type: 'number', min: '0', step: '0.001', inputmode: 'decimal' })
          : field({ label: 'Остаток', name: 'balance', value: numberText(item?.balance), readonly: true }),
        { ariaLabel: 'Единица и количество' },
      )}
      ${field({ label: 'Цена закупки', name: 'purchasePrice', value: item?.lastPurchasePrice ?? '', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
      ${item ? itemSummary(item) : ''}
    </form>`;
  const layer = mountV2ZLayer(root, v2ZLayer(markup, { className: 'inventory-item-z' }), { stack: true });
  if (!layer) return;

  let advanced = {
    category: item?.category || '',
    supplier: item?.supplier || '',
    location: item?.location || '',
    sku: item?.sku || '',
    barcode: item?.barcode || '',
    minStock: item?.minStock ?? null,
    targetStock: item?.targetStock ?? null,
    packageQuantity: item?.packageQuantity ?? null,
  };

  layer.querySelector('[data-inventory-item-advanced]')?.addEventListener('click', (event) => {
    const modalRoot = openAdvancedItemModal(event.currentTarget, advanced);
    const form = modalRoot?.querySelector('[data-inventory-advanced-form]');
    if (!form) return;
    form.addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      const data = new FormData(form);
      advanced = {
        category: String(data.get('category') || '').trim(),
        supplier: String(data.get('supplier') || '').trim(),
        location: String(data.get('location') || '').trim(),
        sku: String(data.get('sku') || '').trim(),
        barcode: String(data.get('barcode') || '').trim(),
        minStock: collectOptionalNumber(form, 'minStock'),
        targetStock: collectOptionalNumber(form, 'targetStock'),
        packageQuantity: collectOptionalNumber(form, 'packageQuantity'),
      };
      modalRoot.v2Close?.();
    });
  });

  layer.querySelector('[data-inventory-item-save]')?.addEventListener('click', async () => {
    const form = layer.querySelector('[data-inventory-item-form]');
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) {
      openNotice({ title: 'Наименование', message: 'Укажите наименование позиции.' });
      return;
    }
    const value = {
      name,
      unit: String(data.get('unit') || 'шт.'),
      lastPurchasePrice: collectOptionalNumber(form, 'purchasePrice'),
      ...advanced,
    };
    if (creating) {
      value.quantity = Math.max(0, Number(String(data.get('quantity') || '0').replace(',', '.')) || 0);
      value.purchasePrice = value.lastPurchasePrice;
    }
    try {
      if (creating) await createInventoryItem(value);
      else await updateInventoryItem(item.itemId, value);
      layer.v2Close?.();
      renderStock(root);
    } catch (error) {
      openNotice({ title: 'Не удалось сохранить', message: error instanceof Error ? error.message : 'Ошибка склада' });
    }
  });
  notifyContext();
}

function movementEditorRow(row = {}, index = 0) {
  const item = getInventoryItem(row.itemId);
  const quantity = row.quantity == null ? '' : Number(row.quantity);
  const direction = row.direction === 'IN' || row.direction === 'OUT' ? row.direction : '';
  return `<div data-inventory-movement-row data-row-index="${index}" data-row-direction="${escapeHtml(direction)}">
    ${twoColumnLayout(
      searchableSelect({
        label: 'Материал',
        name: `itemId-${index}`,
        value: row.itemId || '',
        options: itemOptions(),
        placeholder: 'Выбрать',
        required: true,
      }),
      field({
        label: item?.unit ? `Количество, ${item.unit}` : 'Количество',
        name: `quantity-${index}`,
        value: quantity,
        type: 'number',
        min: '0',
        step: '0.001',
        inputmode: 'decimal',
      }),
      { ariaLabel: 'Материал и количество' },
    )}
  </div>`;
}

function collectMovementRows(host) {
  return [...host.querySelectorAll('[data-inventory-movement-row]')].map((row) => {
    const index = row.dataset.rowIndex;
    const itemId = row.querySelector(`[name="itemId-${CSS.escape(index)}"]`)?.value || '';
    const quantity = Number(String(row.querySelector(`[name="quantity-${CSS.escape(index)}"]`)?.value || '0').replace(',', '.')) || 0;
    const direction = row.dataset.rowDirection === 'IN' || row.dataset.rowDirection === 'OUT' ? row.dataset.rowDirection : undefined;
    return { itemId, quantity, ...(direction ? { direction } : {}) };
  }).filter((row) => row.itemId && row.quantity > 0);
}

function openMovementEditor(root, movementId = '', kind = 'CONSUMPTION') {
  const movement = movementId ? getInventoryMovement(movementId) : null;
  const correcting = Boolean(movement);
  const initialRows = movement?.lines?.length
    ? movement.lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity, direction: line.direction }))
    : [{ itemId: '', quantity: '' }];
  const title = correcting ? movementTitle(movement) : movementTitle({ kind });
  const markup = `
    ${context(title, { c: { label: correcting ? 'Исправить' : 'Сохранить', data: 'data-inventory-movement-save' } })}
    <form data-inventory-movement-form>
      ${correcting && movement.personUei ? `<div class="entity-details"><div><span>UEI</span><strong>${escapeHtml(movement.personUei)}</strong></div></div>` : ''}
      <div data-inventory-movement-rows>${initialRows.map(movementEditorRow).join('')}</div>
      ${button('+ Добавить позицию', { type: 'button', variant: 'secondary', data: 'data-inventory-add-movement-row' })}
      ${field({ label: 'Примечание', name: 'note', value: movement?.note || '' })}
    </form>`;
  const layer = mountV2ZLayer(root, v2ZLayer(markup, { className: 'inventory-movement-z' }), { stack: true });
  if (!layer) return;

  let rowIndex = initialRows.length;
  layer.querySelector('[data-inventory-add-movement-row]')?.addEventListener('click', () => {
    layer.querySelector('[data-inventory-movement-rows]')?.insertAdjacentHTML('beforeend', movementEditorRow({}, rowIndex));
    rowIndex += 1;
  });

  layer.addEventListener('change', (event) => {
    const selectInput = event.target.closest?.('input[name^="itemId-"]');
    if (!selectInput) return;
    const row = selectInput.closest('[data-inventory-movement-row]');
    const item = getInventoryItem(selectInput.value);
    const label = row?.querySelector('input[name^="quantity-"]')?.closest('.field')?.querySelector(':scope > span');
    if (label) label.textContent = item?.unit ? `Количество, ${item.unit}` : 'Количество';
  });

  layer.querySelector('[data-inventory-movement-save]')?.addEventListener('click', async () => {
    const form = layer.querySelector('[data-inventory-movement-form]');
    const lines = collectMovementRows(layer);
    if (!lines.length) {
      openNotice({ title: 'Позиции', message: 'Добавьте хотя бы один материал и количество.' });
      return;
    }
    try {
      if (correcting) {
        await correctInventoryMovement(movement.movementId, {
          lines,
          note: String(new FormData(form).get('note') || '').trim(),
        });
      } else {
        await createInventoryMovement({
          kind,
          sourceType: 'manual',
          note: String(new FormData(form).get('note') || '').trim(),
          lines,
        });
      }
      layer.v2Close?.();
      renderMovements(root);
    } catch (error) {
      openNotice({ title: 'Не удалось сохранить', message: error instanceof Error ? error.message : 'Ошибка склада' });
    }
  });
  notifyContext();
}

function openMovementKind(root, trigger) {
  const actions = [
    ['RECEIPT', 'Приход'],
    ['CONSUMPTION', 'Расход'],
    ['WRITE_OFF', 'Списание'],
    ['RETURN', 'Возврат'],
  ];
  const content = actions.map(([kind, label]) => button(label, {
    type: 'button',
    variant: 'secondary',
    data: `data-inventory-kind="${kind}"`,
  })).join('');
  const modalRoot = mountModal(trigger, modal(content, { title: 'Операция', variant: 'x' }));
  modalRoot?.querySelectorAll('[data-inventory-kind]').forEach((control) => {
    control.addEventListener('click', () => {
      const selectedKind = control.dataset.inventoryKind;
      modalRoot.v2Close?.();
      openMovementEditor(root, '', selectedKind);
    });
  });
}

function stockListMarkup() {
  const items = getInventoryItems();
  if (!items.length) return emptyState('Склад пуст', 'Добавьте первую позицию.');
  return v2ListEntries(items.map((item) => v2ListEntry({
    title: item.name,
    subtitle: [item.category, item.location].filter(Boolean).join(' · '),
    rightTop: `${numberText(item.balance)} ${item.unit}`,
    rightBottom: item.lastPurchasePrice == null ? '' : moneyText(item.lastPurchasePrice),
    interactive: true,
    initial: '',
    data: `data-inventory-item="${escapeHtml(item.itemId)}"`,
    aria: `Открыть ${item.name}`,
  })));
}

function movementJournalMarkup() {
  const movements = getInventoryMovements();
  if (!movements.length) return emptyState('Движений пока нет', 'Приходы и расходы будут собираться здесь блоками.');
  const rows = movements.map((movement, movementIndex) => {
    const header = `<button type="button" class="ui-list__item ui-list__item--group-header${movementIndex ? ' ui-list__item--group-start' : ''}" data-inventory-movement="${escapeHtml(movement.movementId)}" aria-label="Открыть движение ${escapeHtml(movementTitle(movement))}">
      <span class="ui-list__main"><span class="ui-list__title">${escapeHtml(movementTitle(movement))}</span>${movementSubtitle(movement) ? `<span class="ui-list__secondary">${escapeHtml(movementSubtitle(movement))}</span>` : ''}</span>
      <span class="ui-list__right-secondary"><span>${escapeHtml(movementMoment(movement.occurredAt))}</span></span>
    </button>`;
    const lines = (Array.isArray(movement.lines) ? movement.lines : []).map((line) => `<div class="ui-list__item">
      <span class="ui-list__main"><span class="ui-list__title">${escapeHtml(line.name || '')}</span></span>
      <span class="ui-list__right-secondary"><span>${escapeHtml(`${movementSign(line)}${numberText(line.quantity)} ${line.unit || ''}`)}</span></span>
    </div>`).join('');
    return header + lines;
  }).join('');
  return `<div class="ui-list ui-list--dense" data-ui-list>${rows}</div>`;
}

function orderMarkup() {
  const items = inventoryOrderSuggestions();
  if (!items.length) return emptyState('Заказывать пока нечего', 'Когда будет указан минимальный остаток, здесь появятся предложения.');
  return v2ListEntries(items.map((item) => v2ListEntry({
    title: item.name,
    subtitle: `Осталось ${numberText(item.balance)} ${item.unit}`,
    rightTop: `${numberText(item.suggestedQuantity)} ${item.unit}`,
    rightBottom: 'Рекомендация',
    initial: '',
  })));
}

function inventoryCountMarkup() {
  const items = getInventoryItems();
  if (!items.length) return emptyState('Склад пуст', 'Сначала добавьте позиции.');
  return `<form data-inventory-count-form>${items.map((item, index) => twoColumnLayout(
    field({ label: item.name, name: `expected-${index}`, value: `${numberText(item.balance)} ${item.unit}`, readonly: true }),
    field({ label: 'По факту', name: `actual-${index}`, value: '', type: 'number', min: '0', step: '0.001', inputmode: 'decimal', data: `data-count-item="${escapeHtml(item.itemId)}"` }),
    { ariaLabel: `Инвентаризация ${item.name}` },
  )).join('')}</form>`;
}

function renderStock(root) {
  root.innerHTML = `${context('Остатки', {
    a: { kind: 'settings', data: 'data-inventory-settings', aria: 'Настройки склада' },
    c: { label: '+', data: 'data-inventory-add-item', aria: 'Добавить позицию' },
  })}${stockListMarkup()}`;
  root.querySelector('[data-inventory-add-item]')?.addEventListener('click', () => openItemEditor(root));
  root.querySelectorAll('[data-inventory-item]').forEach((control) => control.addEventListener('click', () => openItemEditor(root, control.dataset.inventoryItem)));
  root.querySelector('[data-inventory-settings]')?.addEventListener('click', (event) => {
    mountModal(event.currentTarget, modal('<p class="muted">Расширенные правила задаются внутри каждой позиции. Новичку их заполнять не обязательно.</p>', { title: 'Склад', variant: 'x' }));
  });
  notifyContext();
}

function renderMovements(root) {
  root.innerHTML = `${context('Движения', {
    c: { label: '+', data: 'data-inventory-add-movement', aria: 'Добавить движение' },
  })}${movementJournalMarkup()}`;
  root.querySelector('[data-inventory-add-movement]')?.addEventListener('click', (event) => openMovementKind(root, event.currentTarget));
  root.querySelectorAll('[data-inventory-movement]').forEach((control) => control.addEventListener('click', () => openMovementEditor(root, control.dataset.inventoryMovement)));
  notifyContext();
}

function renderOrders(root) {
  root.innerHTML = `${context('Заказ')}${orderMarkup()}`;
  notifyContext();
}

function renderInventoryCount(root) {
  root.innerHTML = `${context('Инвентаризация', {
    c: { label: 'Завершить', data: 'data-inventory-count-save', aria: 'Завершить инвентаризацию' },
  })}${inventoryCountMarkup()}`;
  root.querySelector('[data-inventory-count-save]')?.addEventListener('click', async () => {
    const form = root.querySelector('[data-inventory-count-form]');
    if (!form) return;
    const lines = [...form.querySelectorAll('[data-count-item]')].map((input) => {
      const item = getInventoryItem(input.dataset.countItem);
      const raw = String(input.value || '').trim();
      if (!raw || !item) return null;
      const actual = Math.max(0, Number(raw.replace(',', '.')) || 0);
      const expected = Number(item.balance) || 0;
      const difference = actual - expected;
      if (Math.abs(difference) < 0.000001) return null;
      return {
        itemId: item.itemId,
        quantity: difference,
        expectedQuantity: expected,
        actualQuantity: actual,
      };
    }).filter(Boolean);
    if (!lines.length) {
      openNotice({ title: 'Инвентаризация', message: 'Расхождений нет или фактические значения не введены.' });
      return;
    }
    try {
      await createInventoryMovement({ kind: 'ADJUSTMENT', sourceType: 'inventory-count', note: 'Инвентаризация', lines });
      renderInventoryCount(root);
    } catch (error) {
      openNotice({ title: 'Не удалось завершить', message: error instanceof Error ? error.message : 'Ошибка склада' });
    }
  });
  notifyContext();
}

export async function renderInventory(root, section = 'stock') {
  root.innerHTML = emptyState('Склад', 'Загружаем данные…');
  try {
    await loadInventory();
  } catch (error) {
    root.innerHTML = emptyState('Склад недоступен', error instanceof Error ? error.message : 'Не удалось загрузить данные.');
    return () => {};
  }

  if (section === 'movements') renderMovements(root);
  else if (section === 'orders') renderOrders(root);
  else if (section === 'counts') renderInventoryCount(root);
  else renderStock(root);
  return () => {};
}
