import { escapeHtml, mountModal, modal, select, initMultiSelect, initCalendar, entityCard } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { timeToMinutes, minutesToTime } from '../core/time.js';
import { updateRecord, deleteRecord, checkRecordTime } from './record-data.js';

const readList = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const people = () => readList('book.people');
const procedures = () => readList('book.procedures').filter((item) => !item.deletedAt);
const clientName = (person) => [person?.name, person?.surname].filter(Boolean).join(' ') || 'Без имени';
const dateKey = (value) => { const date = value instanceof Date ? value : new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const formatDate = (value) => { const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || ''); };
const workplaceName = (id) => getWorkplaces().find((item) => String(item?.key || '') === String(id || ''))?.name || 'Место работы';
const findClient = (record) => { const client = record?.client || {}; return people().find((item) => String(item?.key ?? '') === String(client.key ?? '')) || people().find((item) => String(item?.id ?? '') === String(client.id ?? '')) || client; };

function getBookingStep() {
  try { const profile = JSON.parse(localStorage.getItem('book.profile') || '{}'); const value = Number(profile?.bookingStep); return value === 15 || value === 30 ? value : 60; }
  catch { return 60; }
}

const pickerModal = (content) => modal(content, { className: 'record-modal record-modal--picker' });

function openWorkplacePicker(state, onDone) {
  const workplaces = getWorkplaces();
  const options = workplaces.map((item) => ({ value: item.key, label: item.name || 'Без названия' }));
  const content = `<div class="record-screen record-screen--settings"><div class="modal-title"><h2>Место работы</h2></div>${select({ name: 'recordEditWorkplace', label: 'Место работы', value: state.workplaceId, options, data: 'data-record-edit-workplace-select' })}<button type="button" class="ui-button" data-record-edit-save>Выбрать</button></div>`;
  const m = mountModal(document.body, pickerModal(content)); if (!m) return;
  m.querySelector('[data-record-edit-save]')?.addEventListener('click', () => { state.workplaceId = m.querySelector('[data-record-edit-workplace-select]')?.value || state.workplaceId; m.remove(); onDone(); });
}

function openClientPicker(state, onDone) {
  const all = people(); let filtered = all;
  const content = `<div class="record-screen record-screen--clients"><div class="modal-title"><h2>Клиент</h2></div><div class="record-client-toolbar"><input class="record-client-search" data-record-client-search placeholder="🔍 Найти клиента..." autocomplete="off"></div><div class="record-client-list" data-record-client-list></div></div>`;
  const m = mountModal(document.body, pickerModal(content)); if (!m) return;
  const render = () => { const host = m.querySelector('[data-record-client-list]'); host.innerHTML = filtered.map((person) => entityCard({ id: person.id, title: clientName(person), subtitle: person.phones?.[0] || '', image: person.photo || '', initial: clientName(person).slice(0, 1).toUpperCase(), interactive: true, data: `data-record-client="${escapeHtml(person.key)}"`, className: 'entity-card--compact', aria: `Выбрать клиента ${clientName(person)}` })).join('') || '<div class="muted">Клиенты не найдены.</div>'; host.querySelectorAll('[data-record-client]').forEach((card) => card.addEventListener('click', () => { const person = all.find((item) => String(item.key) === String(card.dataset.recordClient)); if (!person) return; state.client = { key: person.key, id: person.id || '', name: person.name || '', surname: person.surname || '', phone: person.phones?.[0] || '' }; m.remove(); onDone(); })); };
  m.querySelector('[data-record-client-search]')?.addEventListener('input', (event) => { const q = event.target.value.trim().toLocaleLowerCase('ru'); filtered = all.filter((person) => clientName(person).toLocaleLowerCase('ru').includes(q) || String(person.phones?.[0] || '').includes(q)); render(); }); render();
}

function openDatePicker(state, onDone) {
  const workingDates = getDays().filter((day) => String(day?.workplaceId || '') === String(state.workplaceId || '')).map((day) => day.date).filter(Boolean);
  const content = `<div class="record-screen"><div class="modal-title"><h2>Дата</h2></div><div data-record-edit-calendar></div></div>`;
  const m = mountModal(document.body, pickerModal(content)); if (!m) return;
  initCalendar(m.querySelector('[data-record-edit-calendar]'), { month: new Date(`${state.date}T12:00:00`), workingDates, onDateSelect: (value) => { if (!getDay(getDays(), state.workplaceId, value)) { alert('На выбранную дату нет рабочего дня.'); return; } state.date = value; m.remove(); onDone(); } });
}

function openTimePicker(state, original, onDone) {
  const day = getDay(getDays(), state.workplaceId, state.date); const dayTime = getDayTime(day, getWorkplaces()); if (!dayTime) return;
  const currentFrom = timeToMinutes(state.from); const currentTo = timeToMinutes(state.to); const duration = currentFrom != null && currentTo != null && currentTo > currentFrom ? currentTo - currentFrom : 60;
  const step = getBookingStep(); const start = timeToMinutes(dayTime.from); const end = timeToMinutes(dayTime.to); const slots = [];
  if (start != null && end != null) for (let minutes = start; minutes + duration <= end; minutes += step) { const from = minutesToTime(minutes); const to = minutesToTime(minutes + duration); const check = checkRecordTime({ date: state.date, workplaceId: state.workplaceId, from, to, excludeId: original.id }); if (check.ok) slots.push({ from, to }); }
  const content = `<div class="record-screen record-screen--time"><div class="modal-title"><h2>Время</h2></div><div class="record-time-slots" data-record-time-slots>${slots.map((slot) => `<button type="button" class="record-time-slot${slot.from === state.from ? ' is-selected' : ''}" data-record-time-from="${slot.from}" data-record-time-to="${slot.to}" aria-pressed="${slot.from === state.from}">${slot.from}</button>`).join('') || '<div class="muted">Свободного времени нет.</div>'}</div></div>`;
  const m = mountModal(document.body, pickerModal(content)); if (!m) return;
  m.querySelectorAll('[data-record-time-from]').forEach((slot) => slot.addEventListener('click', () => { state.from = slot.dataset.recordTimeFrom || state.from; state.to = slot.dataset.recordTimeTo || state.to; m.remove(); onDone(); }));
}

function openProceduresPicker(state, onDone) {
  const items = procedures(); const selected = new Set((state.procedures || []).map((item) => item?.id).filter(Boolean));
  const content = `<div class="record-screen record-screen--procedures"><div class="modal-title"><h2>Услуги</h2></div><div data-record-edit-procedures></div><button type="button" class="ui-button" data-record-edit-save>Применить</button></div>`;
  const m = mountModal(document.body, pickerModal(content)); if (!m) return;
  const host = m.querySelector('[data-record-edit-procedures]'); host.innerHTML = items.map((item) => `<button type="button" class="record-procedure-row${selected.has(item.id) ? ' is-selected' : ''}" data-record-edit-procedure="${escapeHtml(item.id)}" aria-pressed="${selected.has(item.id)}"><span class="record-procedure-check" aria-hidden="true"></span><span class="record-procedure-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(String(item.duration || 0))} мин</small></span></button>`).join('') || '<div class="muted">Услуг пока нет.</div>';
  initMultiSelect(host, { selectedValues: [...selected], selector: '[data-record-edit-procedure]', valueAttribute: 'recordEditProcedure', onChange: (values) => { selected.clear(); values.forEach((id) => selected.add(id)); } });
  m.querySelector('[data-record-edit-save]')?.addEventListener('click', () => {
    state.procedures = items.filter((item) => selected.has(item.id)).map((item) => ({ id: item.id, name: item.name, cost: item.cost ?? '', duration: Number(item.duration) || 0 }));
    const from = timeToMinutes(state.from);
    const duration = state.procedures.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    if (from != null) state.to = minutesToTime(from + duration);
    m.remove();
    onDone();
  });
}

function confirmDelete(record, onDeleted) {
  const content = `<div class="record-screen"><div class="modal-title"><h2>Удалить запись?</h2></div><p>Запись будет удалена полностью и освободит это время.</p><div class="record-modal-actions modal-actions"><button type="button" class="ui-button ui-button--secondary" data-record-delete-no>Нет</button><button type="button" class="ui-button" data-record-delete-yes>Удалить</button></div></div>`;
  const m = mountModal(document.body, pickerModal(content)); if (!m) return;
  m.querySelector('[data-record-delete-no]')?.addEventListener('click', () => m.remove()); m.querySelector('[data-record-delete-yes]')?.addEventListener('click', () => { if (!deleteRecord(record.id)) return; m.remove(); onDeleted?.(); });
}

export function openRecordView(record, { onClose = () => {} } = {}) {
  if (!record) return;
  const state = { date: record.date, workplaceId: record.workplaceId, from: record.from, to: record.to, client: record.client ? { ...record.client } : null, procedures: Array.isArray(record.procedures) ? record.procedures.map((item) => ({ ...item })) : [] };
  const original = { ...record };
  const render = () => {
    const client = state.client || findClient(record) || {}; const phone = client.phone || client.phones?.[0] || ''; const procedureNames = state.procedures.map((item) => item?.name).filter(Boolean);
    const top = `<button type="button" class="record-card-workplace record-editor-field" data-record-edit-workplace>${escapeHtml(workplaceName(state.workplaceId))}</button><button type="button" class="record-card-datetime record-editor-field" data-record-edit-datetime><span>${escapeHtml(formatDate(state.date))}</span><span>${escapeHtml(state.from || '')}–${escapeHtml(state.to || '')}</span></button>`;
    const clientBlock = `<button type="button" class="record-card-client record-editor-field" data-record-edit-client><strong>${client.id ? `${escapeHtml(client.id)} ` : ''}${escapeHtml(clientName(client))}</strong>${phone ? `<span>${escapeHtml(phone)}</span>` : ''}</button>`;
    const card = entityCard({ top: `${top}${clientBlock}`, bottom: '', right: '', className: 'entity-card--record', data: 'data-record-card' });
    const services = `<button type="button" class="record-record-services record-editor-field" data-record-edit-procedures>${procedureNames.length ? procedureNames.map((item) => `<span>${escapeHtml(item)}</span>`).join('') : '<span>Добавить услугу</span>'}</button>`;
    const content = `<div class="record-view"><div class="record-view-card">${card}</div><div class="record-view-services">${services}</div><div class="record-view-actions"><button type="button" class="ui-button ui-button--small record-delete-button" data-record-delete>Удалить</button><button type="button" class="ui-button record-apply-button" data-record-apply>Применить</button></div></div>`;
    const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--view' })); if (!m) return;
    m.querySelector('[data-record-edit-workplace]')?.addEventListener('click', () => { m.remove(); openWorkplacePicker(state, render); }); m.querySelector('[data-record-edit-client]')?.addEventListener('click', () => { m.remove(); openClientPicker(state, render); }); m.querySelector('[data-record-edit-datetime]')?.addEventListener('click', () => { m.remove(); openDatePicker(state, () => openTimePicker(state, original, render)); }); m.querySelector('[data-record-edit-procedures]')?.addEventListener('click', () => { m.remove(); openProceduresPicker(state, render); });
    m.querySelector('[data-record-delete]')?.addEventListener('click', () => confirmDelete(record, () => { m.remove(); onClose?.(); })); m.querySelector('[data-record-apply]')?.addEventListener('click', () => { const updated = updateRecord(record.id, { date: dateKey(state.date), workplaceId: String(state.workplaceId || ''), from: state.from, to: state.to, client: state.client, procedures: state.procedures }); if (!updated) { alert('Не удалось сохранить изменения: проверьте рабочий день и свободное время.'); return; } m.remove(); onClose?.(); }); m.addEventListener('modal:close', () => onClose?.(), { once: true });
  };
  render();
}
