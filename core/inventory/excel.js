import {
  button,
  field,
  modal,
  mountModal,
  openNotice,
  selectFile,
  v2ListEntries,
  v2ListEntry,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { apiRequest } from '../auth.js';
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
  createInventoryMovement,
  loadInventory,
} from './service.js';
import { renderInventory } from './inventory.js';

const XLSX_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let activeMovementId = '';
let activeMovementKind = 'CONSUMPTION';

function numberText(value, maximum = 3) {
  const number = Number(value) || 0;
  return number.toLocaleString('ru-RU', { maximumFractionDigits: maximum }).replaceAll('\u00a0', ' ');
}

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function errorMessage(error, fallback = 'Ошибка Excel') {
  return error instanceof Error ? error.message : fallback;
}

async function jsonRequest(path, options = {}) {
  const response = await apiRequest(`/inventory/excel${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось обработать Excel');
  return payload;
}

async function downloadWorkbook(path, { method = 'GET', body = null, fallback = 'warehouse.xlsx' } = {}) {
  const response = await apiRequest(`/inventory/excel${path}`, {
    method,
    ...(body == null ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'Не удалось выгрузить Excel');
  }
  const blob = await response.blob();
  const disposition = String(response.headers.get('content-disposition') || '');
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function actionButton(label, data) {
  return button(label, { type: 'button', variant: 'secondary', data });
}

function excelAction(trigger, actions = [], title = 'Excel') {
  const content = actions.map((action) => actionButton(action.label, `data-inventory-excel-action="${escapeHtml(action.id)}"`)).join('');
  const modalRoot = mountModal(trigger, modal(content, { title, variant: 'x' }));
  actions.forEach((action) => {
    modalRoot?.querySelector(`[data-inventory-excel-action="${CSS.escape(action.id)}"]`)?.addEventListener('click', async () => {
      modalRoot.v2Close?.();
      try {
        await action.run();
      } catch (error) {
        openNotice({ title: 'Excel', message: errorMessage(error) });
      }
    });
  });
}

function previewMarkup(preview = {}, kind = 'items') {
  const errors = Array.isArray(preview.errors) ? preview.errors : [];
  const stats = kind === 'movements'
    ? `Строк: ${Number(preview.rows) || 0} · Блоков: ${Number(preview.groups) || 0}`
    : `Строк: ${Number(preview.rows) || 0} · Новых: ${Number(preview.create) || 0} · Обновлений: ${Number(preview.update) || 0}`;
  return `<div class="entity-details"><div><span>Проверка</span><strong>${escapeHtml(stats)}</strong></div></div>
    ${errors.length ? `<div class="entity-details">${errors.slice(0, 20).map((message) => `<div><span>Ошибка</span><strong>${escapeHtml(message)}</strong></div>`).join('')}</div>` : ''}`;
}

async function refresh(root, section) {
  await renderInventory(root, section);
  enhanceInventoryExcel(root, section);
}

async function importWorkbook(root, section, kind) {
  const file = await selectFile({ accept: XLSX_ACCEPT });
  if (!file?.dataUrl) return;
  const preview = await jsonRequest(`/${kind}/preview`, {
    method: 'POST',
    body: JSON.stringify({ dataUrl: file.dataUrl }),
  });
  const errors = Array.isArray(preview.errors) ? preview.errors : [];
  const content = `${previewMarkup(preview, kind)}${errors.length ? '' : button('Импортировать', { type: 'button', data: 'data-inventory-excel-confirm' })}`;
  const modalRoot = mountModal(document.body, modal(content, { title: 'Импорт Excel', variant: 'x' }));
  modalRoot?.querySelector('[data-inventory-excel-confirm]')?.addEventListener('click', async () => {
    try {
      await jsonRequest(`/${kind}/import`, {
        method: 'POST',
        body: JSON.stringify({ dataUrl: file.dataUrl }),
      });
      modalRoot.v2Close?.();
      await refresh(root, section);
    } catch (error) {
      openNotice({ title: 'Импорт', message: errorMessage(error) });
    }
  });
}

function replaceContextAction(root, nextAction, onClick) {
  const old = root.querySelector('[data-workspace-context-action]');
  if (old) {
    const clone = old.cloneNode(true);
    old.replaceWith(clone);
    clone.addEventListener('click', onClick);
    return clone;
  }
  const contextRoot = root.querySelector('[data-workspace-header-context]');
  if (!contextRoot) return null;
  const holder = document.createElement('div');
  holder.innerHTML = workspaceHeaderContext({ title: '', a: nextAction });
  const action = holder.querySelector('[data-workspace-context-action]');
  if (!action) return null;
  contextRoot.appendChild(action);
  action.addEventListener('click', onClick);
  notifyContext();
  return action;
}

function appendPrimaryAction(root, action, onClick) {
  const contextRoot = root.querySelector('[data-workspace-header-context]');
  if (!contextRoot) return null;
  contextRoot.querySelector('[data-v2-primary-action]')?.remove();
  const holder = document.createElement('div');
  holder.innerHTML = workspaceHeaderContext({ title: '', c: action });
  const control = holder.querySelector('[data-v2-primary-action]');
  if (!control) return null;
  contextRoot.appendChild(control);
  control.addEventListener('click', onClick);
  notifyContext();
  return control;
}

function enhanceStock(root) {
  replaceContextAction(root, { kind: 'settings', label: 'Excel', aria: 'Excel склада' }, (event) => {
    excelAction(event.currentTarget, [
      { id: 'template', label: 'Скачать шаблон', run: () => downloadWorkbook('/items/template', { fallback: 'ostatki_template.xlsx' }) },
      { id: 'import', label: 'Импортировать', run: () => importWorkbook(root, 'stock', 'items') },
      { id: 'export', label: 'Выгрузить', run: () => downloadWorkbook('/items/export', { fallback: 'ostatki.xlsx' }) },
    ]);
  });
}

function openMovementExport(trigger) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - 1);
  const from = fromDate.toISOString().slice(0, 10);
  const content = `<form data-inventory-export-period>
    ${field({ label: 'С', name: 'from', type: 'date', value: from })}
    ${field({ label: 'До', name: 'to', type: 'date', value: to })}
    ${button('Выгрузить', { type: 'submit' })}
  </form>`;
  const modalRoot = mountModal(trigger, modal(content, { title: 'Период', variant: 'x' }));
  modalRoot?.querySelector('[data-inventory-export-period]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = String(data.get('from') || '');
    const end = String(data.get('to') || '');
    try {
      await downloadWorkbook(`/movements/export?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`, { fallback: 'dvizheniya.xlsx' });
      modalRoot.v2Close?.();
    } catch (error) {
      openNotice({ title: 'Excel', message: errorMessage(error) });
    }
  });
}

function sectionValues() {
  return [...new Set(getInventoryMovements().flatMap((movement) => (Array.isArray(movement.lines) ? movement.lines : []).map((line) => String(line.note || '').trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

function sectionDatalist() {
  const values = sectionValues();
  if (!values.length) return '';
  return `<datalist id="inventory-section-values">${values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('')}</datalist>`;
}

function collectMovementRows(layer, section = '') {
  return [...layer.querySelectorAll('[data-inventory-movement-row]')].map((row) => {
    const index = row.dataset.rowIndex;
    const itemId = row.querySelector(`[name="itemId-${CSS.escape(index)}"]`)?.value || '';
    const quantity = Number(String(row.querySelector(`[name="quantity-${CSS.escape(index)}"]`)?.value || '0').replace(',', '.')) || 0;
    const direction = row.dataset.rowDirection === 'IN' || row.dataset.rowDirection === 'OUT' ? row.dataset.rowDirection : undefined;
    return { itemId, quantity, note: section, ...(direction ? { direction } : {}) };
  }).filter((row) => row.itemId && row.quantity > 0);
}

function enhanceMovementEditor(root, layer) {
  const form = layer.querySelector('[data-inventory-movement-form]');
  const save = layer.querySelector('[data-inventory-movement-save]');
  if (!form || !save || form.dataset.inventoryExcelEnhanced === 'true') return;
  form.dataset.inventoryExcelEnhanced = 'true';
  const movement = activeMovementId ? getInventoryMovement(activeMovementId) : null;
  const existingSection = movement?.lines?.find((line) => String(line.note || '').trim())?.note || '';
  const metadata = document.createElement('div');
  metadata.innerHTML = `${sectionDatalist()}
    ${field({ label: 'UEI', name: 'personUei', value: movement?.personUei || '', readonly: Boolean(movement) })}
    ${field({ label: 'Процедура', name: 'procedureKey', value: movement?.procedureKey || '', readonly: Boolean(movement) })}
    ${field({ label: 'Часть / зона', name: 'section', value: existingSection, autocomplete: 'off', data: 'list="inventory-section-values"' })}`;
  const rows = form.querySelector('[data-inventory-movement-rows]');
  if (rows) rows.before(...metadata.childNodes);

  layer.addEventListener('click', async (event) => {
    const control = event.target.closest?.('[data-inventory-movement-save]');
    if (!control || !layer.contains(control)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = new FormData(form);
    const section = String(data.get('section') || '').trim();
    const lines = collectMovementRows(layer, section);
    if (!lines.length) {
      openNotice({ title: 'Позиции', message: 'Добавьте хотя бы один материал и количество.' });
      return;
    }
    try {
      if (movement) {
        await correctInventoryMovement(movement.movementId, {
          lines,
          note: String(data.get('note') || '').trim(),
        });
      } else {
        await createInventoryMovement({
          kind: activeMovementKind || 'CONSUMPTION',
          sourceType: 'manual',
          personUei: String(data.get('personUei') || '').trim(),
          procedureKey: String(data.get('procedureKey') || '').trim(),
          note: String(data.get('note') || '').trim(),
          lines,
        });
      }
      activeMovementId = '';
      layer.v2Close?.();
      await refresh(root, 'movements');
    } catch (error) {
      openNotice({ title: 'Не удалось сохранить', message: errorMessage(error, 'Ошибка склада') });
    }
  }, true);
}

function enhanceMovements(root) {
  replaceContextAction(root, { kind: 'settings', label: 'Excel', aria: 'Excel движений' }, (event) => {
    excelAction(event.currentTarget, [
      { id: 'template', label: 'Скачать шаблон', run: () => downloadWorkbook('/movements/template', { fallback: 'dvizheniya_template.xlsx' }) },
      { id: 'import', label: 'Импортировать', run: () => importWorkbook(root, 'movements', 'movements') },
      { id: 'export', label: 'Выгрузить за период', run: () => openMovementExport(event.currentTarget) },
    ]);
  });

  root.addEventListener('click', (event) => {
    const movementControl = event.target.closest?.('[data-inventory-movement]');
    if (movementControl) activeMovementId = String(movementControl.dataset.inventoryMovement || '');
    if (event.target.closest?.('[data-inventory-add-movement]')) activeMovementId = '';
  }, true);

  const observer = new MutationObserver(() => {
    root.querySelectorAll('.inventory-movement-z').forEach((layer) => enhanceMovementEditor(root, layer));
  });
  observer.observe(root, { childList: true, subtree: true });
  root.querySelectorAll('.inventory-movement-z').forEach((layer) => enhanceMovementEditor(root, layer));
}

function orderListMarkup() {
  const items = inventoryOrderSuggestions();
  if (!items.length) return '';
  return v2ListEntries(items.map((item) => v2ListEntry({
    title: item.name,
    subtitle: `Осталось ${numberText(item.balance)} ${item.unit}`,
    rightTop: `${numberText(item.suggestedQuantity)} ${item.unit}`,
    rightBottom: item.supplier || '',
    initial: '',
    selected: true,
    interactive: true,
    data: `data-inventory-order-item="${escapeHtml(item.itemId)}" data-order-quantity="${escapeHtml(item.suggestedQuantity)}"`,
    aria: `Выбрать ${item.name} для заказа`,
  })));
}

function enhanceOrders(root) {
  const contextRoot = root.querySelector('[data-workspace-header-context]');
  const items = inventoryOrderSuggestions();
  if (!contextRoot || !items.length) return;
  [...root.children].filter((node) => node !== contextRoot).forEach((node) => node.remove());
  contextRoot.insertAdjacentHTML('afterend', orderListMarkup());
  root.querySelectorAll('[data-inventory-order-item]').forEach((control) => {
    control.addEventListener('click', () => {
      const selected = !control.classList.contains('is-selected');
      control.classList.toggle('is-selected', selected);
      control.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  });
  appendPrimaryAction(root, { label: 'Выгрузить', aria: 'Выгрузить выбранный заказ' }, async () => {
    const selections = [...root.querySelectorAll('[data-inventory-order-item].is-selected')].map((control) => ({
      itemId: control.dataset.inventoryOrderItem,
      quantity: Number(control.dataset.orderQuantity) || 0,
    })).filter((row) => row.itemId && row.quantity > 0);
    if (!selections.length) {
      openNotice({ title: 'Заказ', message: 'Выберите позиции для заказа.' });
      return;
    }
    try {
      await downloadWorkbook('/orders/export', { method: 'POST', body: { selections }, fallback: 'zakaz.xlsx' });
    } catch (error) {
      openNotice({ title: 'Excel', message: errorMessage(error) });
    }
  });
}

let movementKindListenerReady = false;
function ensureMovementKindListener() {
  if (movementKindListenerReady) return;
  movementKindListenerReady = true;
  document.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-inventory-kind]');
    if (!control) return;
    activeMovementKind = String(control.dataset.inventoryKind || 'CONSUMPTION');
  }, true);
}

export function enhanceInventoryExcel(root, section = 'stock') {
  if (!root) return;
  ensureMovementKindListener();
  if (section === 'stock') enhanceStock(root);
  else if (section === 'movements') enhanceMovements(root);
  else if (section === 'orders') enhanceOrders(root);
}
