import { escapeHtml, mountModal, modal, select, timePicker, initTimePickers } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { moveRecord, cancelRecord, deleteRecord, checkRecordTime } from './record-data.js';

const readList = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const people = () => readList('book.people');
const clientName = (person) => [person?.name, person?.surname].filter(Boolean).join(' ') || 'Без имени';
const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const findClient = (record) => {
  const client = record?.client || {};
  return people().find((item) => String(item?.key ?? '') === String(client.key ?? ''))
    || people().find((item) => String(item?.id ?? '') === String(client.id ?? ''))
    || client;
};
const workplaceName = (id) => getWorkplaces().find((item) => String(item?.key || '') === String(id || ''))?.name || 'Место работы';

function openMoveModal(record, onChanged) {
  const workplaces = getWorkplaces();
  const options = workplaces.map((item) => ({ value: item.key, label: item.name || 'Без названия' }));
  const content = `<div class="record-screen record-screen--move">
    <div class="modal-title"><h2>Перенести запись</h2></div>
    <div class="form-grid">
      <label class="field"><span class="field__label">Дата</span><input class="field__input" type="date" data-record-move-date value="${escapeHtml(record.date || '')}"></label>
      ${select({ name: 'recordMoveWorkplace', label: 'Место работы', value: record.workplaceId || '', options, data: 'data-record-move-workplace' })}
      ${timePicker({ name: 'recordMoveFrom', label: 'Начало', value: record.from || '09:00' })}
      ${timePicker({ name: 'recordMoveTo', label: 'Окончание', value: record.to || '10:00' })}
    </div>
    <div class="form-error" data-record-move-error></div>
    <div class="record-modal-actions modal-actions"><button type="button" class="ui-button ui-button--secondary" data-record-move-cancel>Отмена</button><button type="button" class="ui-button" data-record-move-save>Перенести</button></div>
  </div>`;
  const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--panel' }));
  if (!m) return;
  initTimePickers(m);
  m.querySelector('[data-record-move-cancel]')?.addEventListener('click', () => m.remove());
  m.querySelector('[data-record-move-save]')?.addEventListener('click', () => {
    const nextDate = m.querySelector('[data-record-move-date]')?.value || record.date;
    const nextWorkplace = m.querySelector('[data-record-move-workplace]')?.value || record.workplaceId;
    const nextFrom = m.querySelector('[name="recordMoveFrom"]')?.value || record.from;
    const nextTo = m.querySelector('[name="recordMoveTo"]')?.value || record.to;
    const check = checkRecordTime({ date: nextDate, workplaceId: nextWorkplace, from: nextFrom, to: nextTo, excludeId: record.id });
    const error = m.querySelector('[data-record-move-error]');
    if (!check.ok) {
      const message = check.reason === 'day-not-working'
        ? 'Выбранный день не является рабочим. Выберите другой день.'
        : check.reason === 'occupied'
          ? 'Это время уже занято. Выберите другое время или другой день.'
          : check.reason === 'outside-working-time'
            ? `Время записи должно находиться внутри рабочего времени дня: ${check.time?.from || ''}–${check.time?.to || ''}.`
            : 'Проверьте дату и время.';
      if (error) error.textContent = message;
      return;
    }
    const updated = moveRecord(record.id, { date: nextDate, workplaceId: nextWorkplace, from: nextFrom, to: nextTo });
    if (!updated) {
      if (error) error.textContent = 'Не удалось перенести запись. Проверьте свободное время.';
      return;
    }
    m.remove();
    onChanged?.(updated);
  });
}

function confirmDelete(record, onChanged) {
  const content = `<div class="record-screen"><div class="modal-title"><h2>Удалить запись?</h2></div><p>Запись будет удалена полностью и больше не будет занимать время.</p><div class="record-modal-actions modal-actions"><button type="button" class="ui-button ui-button--secondary" data-record-delete-cancel>Отмена</button><button type="button" class="ui-button" data-record-delete-confirm>Удалить</button></div></div>`;
  const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--panel' }));
  if (!m) return;
  m.querySelector('[data-record-delete-cancel]')?.addEventListener('click', () => m.remove());
  m.querySelector('[data-record-delete-confirm]')?.addEventListener('click', () => {
    if (!deleteRecord(record.id)) return;
    m.remove();
    onChanged?.();
  });
}

export function openRecordView(record, { onClose = () => {} } = {}) {
  if (!record) return;
  const client = findClient(record);
  const name = clientName(client);
  const phone = client?.phones?.[0] || client?.phone || '';
  const services = (record.procedures || []).map((item) => item?.name).filter(Boolean).join(', ');
  const content = `<div class="record-view">
    <div class="record-view-card">
      <div class="record-card-topline"><span>${escapeHtml(workplaceName(record.workplaceId))}</span><strong>${escapeHtml(record.date || '')} ${escapeHtml(record.from || '')}–${escapeHtml(record.to || '')}</strong></div>
      <div class="record-card-client"><strong>${record.client?.id ? `${escapeHtml(record.client.id)} ` : ''}${escapeHtml(name)}</strong>${phone ? `<span>${escapeHtml(phone)}</span>` : ''}</div>
      ${services ? `<div class="record-card-procedures"><span>${escapeHtml(services)}</span></div>` : ''}
    </div>
    <div class="record-view-actions">
      <button type="button" class="ui-button" data-record-move>Перенести</button>
      <button type="button" class="ui-button ui-button--secondary" data-record-cancel>Отменить запись</button>
      <button type="button" class="ui-button ui-button--secondary" data-record-delete>Удалить</button>
    </div>
  </div>`;
  const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--view' }));
  if (!m) return;
  const changed = () => { m.remove(); onClose?.(); };
  m.querySelector('[data-record-move]')?.addEventListener('click', () => { m.remove(); openMoveModal(record, changed); });
  m.querySelector('[data-record-cancel]')?.addEventListener('click', () => {
    if (!cancelRecord(record.id)) return;
    changed();
  });
  m.querySelector('[data-record-delete]')?.addEventListener('click', () => confirmDelete(record, changed));
  m.addEventListener('modal:close', () => onClose?.(), { once: true });
}
