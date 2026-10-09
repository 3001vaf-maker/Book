import {
  button,
  durationPicker,
  escapeHtml,
  initDurationPickers,
  modal,
  mountModal,
  openNotice,
  select,
} from '../ui/ui.js';
import { getProcedures } from '../core/service/procedures/data.js';
import { checkTimeAvailability, minutesToTime, timeToMinutes } from '../core/time/index.js';

const procedures = () => getProcedures();

function workplaceAssignment(procedure, workplaceId) {
  const id = String(workplaceId || '');
  return (procedure?.workplaces || []).find((workplace) => String(workplace?.workplaceId ?? workplace?.id ?? workplace?.key ?? '') === id) || null;
}

function procedureForWorkplace(procedure, workplaceId) {
  return workplaceAssignment(procedure, workplaceId) ? procedure : null;
}

function defaultCost(procedure, workplaceId) {
  const assignment = workplaceAssignment(procedure, workplaceId);
  const assignmentCost = assignment?.cost;
  const procedureCost = procedure?.cost;
  const cost = assignmentCost && typeof assignmentCost === 'object' && !assignmentCost.free && (
    assignmentCost.amount !== '' && assignmentCost.amount != null
    || assignmentCost.from !== '' && assignmentCost.from != null
    || assignmentCost.to !== '' && assignmentCost.to != null
  ) ? assignmentCost : procedureCost;
  if (!cost || cost.free) return '';
  if (typeof cost === 'number' || typeof cost === 'string') return cost;
  return cost.amount ?? cost.from ?? '';
}

function catalogProcedure(id) {
  return procedures().find((item) => String(item?.id || '') === String(id || '')) || null;
}

function normalizeProcedures(selectedProcedures, workplaceId) {
  return (Array.isArray(selectedProcedures) ? selectedProcedures : []).map((entry) => {
    const source = entry?.procedure || entry || {};
    const id = String(source?.id || entry?.id || '');
    const catalog = catalogProcedure(id);
    const procedure = catalog || source;
    return {
      ...entry,
      id,
      name: String(procedure?.name || entry?.name || 'Процедура'),
      cost: entry?.cost ?? defaultCost(procedure, workplaceId),
      duration: Number(entry?.duration ?? procedure?.duration) || 0,
    };
  }).filter((item) => item.id);
}

function availableProcedures(workplaceId) {
  return procedures().filter((procedure) => procedureForWorkplace(procedure, workplaceId));
}

function recordEndTime(from, items) {
  const start = timeToMinutes(from);
  if (start == null) return '';
  const duration = items.reduce((sum, item) => sum + (Number(item?.duration) || 0), 0);
  return minutesToTime(start + duration) || '';
}

function applyCorrection({ items, date, workplaceId, from, excludeId, onApply }) {
  const to = recordEndTime(from, items);
  if (items.length && to && !checkTimeAvailability({
    date,
    workplaceId,
    from,
    to,
    excludeId,
  }).ok) {
    openNotice({
      title: 'Недостаточно времени',
      message: 'Для скорректированных процедур не хватает свободного времени.',
    });
    return false;
  }
  onApply?.({ procedures: items.map((item) => ({ ...item })), to });
  return true;
}

function openProcedureEditor({
  item = null,
  items,
  date,
  workplaceId,
  from,
  excludeId,
  onApply,
}) {
  const currentId = String(item?.id || '');
  const usedIds = new Set(items
    .filter((entry) => String(entry?.id || '') !== currentId)
    .map((entry) => String(entry?.id || '')));
  const candidates = availableProcedures(workplaceId)
    .filter((procedure) => !usedIds.has(String(procedure?.id || '')));
  const initialProcedure = currentId ? (catalogProcedure(currentId) || item) : null;
  const initialDuration = Number(item?.duration ?? initialProcedure?.duration) || 0;
  const canAdd = availableProcedures(workplaceId)
    .some((procedure) => !items.some((entry) => String(entry?.id || '') === String(procedure?.id || '')));
  const options = [
    { value: '', label: 'Без выбора' },
    ...candidates.map((procedure) => ({ value: String(procedure.id || ''), label: procedure.name || 'Процедура' })),
  ];
  const html = `<div class="modal-title"><h2>${escapeHtml(item?.name || 'Процедура')}</h2><p>${item ? 'Можно заменить процедуру, скорректировать её время или удалить.' : 'Выберите процедуру и задайте её время.'}</p></div>
    <div class="compact-form">
      ${select({
        label: 'Процедура',
        name: 'recordProcedureCorrectionValue',
        value: currentId,
        options,
        aria: 'Выберите процедуру',
      })}
      ${durationPicker({ name: 'recordProcedureCorrectionDuration', label: 'Время', value: initialDuration })}
      <div class="modal-actions">
        ${button('Сохранить', { data: 'data-record-procedure-correction-save' })}
        ${item && canAdd ? button('+ Добавить процедуру', { data: 'data-record-procedure-correction-add', variant: 'secondary' }) : ''}
        ${item ? button('Удалить процедуру', { data: 'data-record-procedure-correction-delete', variant: 'danger' }) : ''}
      </div>
    </div>`;
  const layer = mountModal(document.body, modal(html, {
    variant: 'x',
    surface: 'app',
    title: 'Корректировка',
    className: 'modal--form-sheet',
  }));
  if (!layer) return;
  initDurationPickers(layer);
  const procedureInput = layer.querySelector('input[name="recordProcedureCorrectionValue"]');
  procedureInput?.addEventListener('change', () => {
    const next = catalogProcedure(procedureInput.value);
    if (!next || String(next.id || '') === currentId) return;
    const durationValue = layer.querySelector('[data-duration-value]');
    if (durationValue) {
      const assignment = workplaceAssignment(next, workplaceId);
      durationValue.value = String(Number(assignment?.duration ?? next.duration) || 0);
      durationValue.dispatchEvent(new Event('input', { bubbles: true }));
      durationValue.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  layer.querySelector('[data-record-procedure-correction-add]')?.addEventListener('click', () => {
    layer.v2Close?.();
    openProcedureEditor({ items, date, workplaceId, from, excludeId, onApply });
  });
  layer.querySelector('[data-record-procedure-correction-save]')?.addEventListener('click', () => {
    const nextId = String(procedureInput?.value || '');
    const nextProcedure = catalogProcedure(nextId);
    if (!nextProcedure || !procedureForWorkplace(nextProcedure, workplaceId)) {
      openNotice({ title: 'Процедура', message: 'Выберите процедуру.' });
      return;
    }
    const durationValue = Number(layer.querySelector('[data-duration-value]')?.value);
    const assignment = workplaceAssignment(nextProcedure, workplaceId);
    const nextItem = {
      ...(item || {}),
      id: String(nextProcedure.id || ''),
      name: String(nextProcedure.name || 'Процедура'),
      cost: nextId === currentId && item ? item.cost : defaultCost(nextProcedure, workplaceId),
      duration: Number.isFinite(durationValue)
        ? durationValue
        : (Number(assignment?.duration ?? nextProcedure.duration) || 0),
    };
    const nextItems = item
      ? items.map((entry) => String(entry?.id || '') === currentId ? nextItem : entry)
      : [...items, nextItem];
    if (!applyCorrection({ items: nextItems, date, workplaceId, from, excludeId, onApply })) return;
    layer.v2Close?.();
  });
  layer.querySelector('[data-record-procedure-correction-delete]')?.addEventListener('click', () => {
    const nextItems = items.filter((entry) => String(entry?.id || '') !== currentId);
    if (!applyCorrection({ items: nextItems, date, workplaceId, from, excludeId, onApply })) return;
    layer.v2Close?.();
  });
}

export function openRecordProcedureCorrection({
  date,
  workplaceId,
  from,
  selectedProcedures = [],
  procedureIndex = -1,
  excludeId = '',
  onApply = () => {},
} = {}) {
  const items = normalizeProcedures(selectedProcedures, workplaceId);
  const index = Number(procedureIndex);
  const item = Number.isInteger(index) && index >= 0 ? items[index] : null;
  openProcedureEditor({ item, items, date, workplaceId, from, excludeId, onApply });
}
