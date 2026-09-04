import { entityCard, escapeHtml, mountModal, modal, timePicker, initTimePickers, initMultiSelect, initCalendar } from '../ui/ui.js';
import { updateRecord, deleteRecord } from '../core/record.js';
import { isTimeRangeAvailable, getTimeUsages } from '../core/time-usage.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay } from '../core/day.js';

const readList = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const people = () => readList('book.people');
const procedures = () => readList('book.procedures').filter((item) => !item.deletedAt);
const clientName = (person) => [person?.name, person?.surname].filter(Boolean).join(' ') || 'Без имени';
const timeToMinutes = (value) => { const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/); return match ? Number(match[1]) * 60 + Number(match[2]) : null; };
const minutesToTime = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const dateKey = (date) => { const d = date instanceof Date ? date : new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatDate = (value) => { const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || ''); };
const findWorkplace = (id) => getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(id ?? '')) || null;
const findClient = (record) => { const client = record?.client || {}; return people().find((item) => String(item?.key ?? '') === String(client.key ?? '')) || people().find((item) => String(item?.id ?? '') === String(client.id ?? '')) || client; };
function scopedUsages(date, workplaceId, excludeId = '') { const day = dateKey(date); return getTimeUsages({ records: readList('book.records').filter((item) => item?.date === day && String(item?.workplaceId || '') === String(workplaceId || '') && String(item?.id || '') !== String(excludeId || '')), breaks: readList('book.journalBreaks').filter((item) => item?.date === day && String(item?.workplaceId || '') === String(workplaceId || '')) }); }
function available({ date, workplaceId, from, to, excludeId }) { return isTimeRangeAvailable({ from, to, usages: scopedUsages(date, workplaceId, excludeId) }); }

function openWorkplaceEditor(parent, state) {
  const workplaces = getWorkplaces();
  const options = workplaces.map((item) => `<option value="${escapeHtml(item.key)}" ${String(item.key) === String(state.workplaceId) ? 'selected' : ''}>${escapeHtml(item.name || 'Без названия')}</option>`).join('');
  const content = `<div class="record-editor-screen"><div class="modal-title"><h2>Место работы</h2></div><label class="field"><span>Место работы</span><select data-editor-workplace>${options}</select></label><button type="button" class="ui-button" data-editor-save>Выбрать</button></div>`;
  const m = mountModal(document.body, modal(content, { title: 'Место работы', className: 'record-editor-modal' })); if (!m) return;
  m.querySelector('[data-editor-save]')?.addEventListener('click', () => { state.workplaceId = m.querySelector('[data-editor-workplace]')?.value || state.workplaceId; m.remove(); parent(); });
}

function openClientEditor(parent, state) {
  const all = people(); let filtered = all;
  const content = `<div class="record-editor-screen record-editor-screen--clients"><div class="modal-title"><h2>Клиент</h2></div><div class="record-client-toolbar"><input class="record-client-search" data-editor-client-search placeholder="🔍 Найти клиента..." autocomplete="off"></div><div class="record-client-list" data-editor-client-list></div></div>`;
  const m = mountModal(document.body, modal(content, { title: 'Клиент', className: 'record-editor-modal' })); if (!m) return;
  const render = () => { const host = m.querySelector('[data-editor-client-list]'); host.innerHTML = filtered.map((person) => entityCard({ id: person.id, title: clientName(person), subtitle: person.phones?.[0] || '', image: person.photo || '', initial: clientName(person).slice(0, 1).toUpperCase(), interactive: true, data: `data-editor-client="${escapeHtml(person.key)}"`, className: 'entity-card--compact', aria: `Выбрать клиента ${clientName(person)}` })).join('') || '<div class="muted">Клиенты не найдены.</div>'; host.querySelectorAll('[data-editor-client]').forEach((card) => card.addEventListener('click', () => { const selected = all.find((person) => String(person.key) === String(card.dataset.editorClient)); if (selected) state.client = { key: selected.key, id: selected.id || '', name: selected.name || '', surname: selected.surname || '', phone: selected.phones?.[0] || '' }; m.remove(); parent(); })); };
  m.querySelector('[data-editor-client-search]')?.addEventListener('input', (event) => { const q = event.target.value.trim().toLocaleLowerCase('ru'); filtered = all.filter((person) => clientName(person).toLocaleLowerCase('ru').includes(q) || String(person.phones?.[0] || '').includes(q)); render(); }); render();
}

function openDateEditor(parent, state) {
  const workingDates = getDays().filter((day) => String(day?.workplaceId || '') === String(state.workplaceId || '')).map((day) => day.date).filter(Boolean);
  const content = `<div class="record-editor-screen"><div class="modal-title"><h2>Дата</h2></div><div data-editor-calendar></div></div>`;
  const m = mountModal(document.body, modal(content, { title: 'Дата', className: 'record-editor-modal' })); if (!m) return;
  const root = m.querySelector('[data-editor-calendar]');
  initCalendar(root, { month: new Date(`${state.date}T12:00:00`), workingDates, onDateSelect: (value) => { if (!getDay(getDays(), state.workplaceId, value)) { alert('На эту дату нет рабочего дня.'); return; } state.date = value; m.remove(); parent(); } });
}

function openTimeEditor(parent, state, original) {
  const content = `<div class="record-editor-screen"><div class="modal-title"><h2>Время</h2></div><div class="timetable-time-fields">${timePicker({ name: 'editorFrom', label: 'Начало', value: state.from, minuteStep: 5 })}${timePicker({ name: 'editorTo', label: 'Окончание', value: state.to, minuteStep: 5 })}</div><div class="form-error" data-editor-time-error></div><button type="button" class="ui-button" data-editor-save>Выбрать</button></div>`;
  const m = mountModal(document.body, modal(content, { title: 'Время', className: 'record-editor-modal' })); if (!m) return; initTimePickers(m);
  m.querySelector('[data-editor-save]')?.addEventListener('click', () => { const from = m.querySelector('[name="editorFrom"]')?.value || state.from; const to = m.querySelector('[name="editorTo"]')?.value || state.to; if (!available({ date: state.date, workplaceId: state.workplaceId, from, to, excludeId: original.id })) { m.querySelector('[data-editor-time-error]').textContent = 'Это время занято или выходит за рабочее время.'; return; } state.from = from; state.to = to; m.remove(); parent(); });
}

function openProceduresEditor(parent, state) {
  const items = procedures(); const selected = new Set((state.procedures || []).map((item) => item?.id).filter(Boolean));
  const content = `<div class="record-editor-screen record-editor-screen--clients"><div class="modal-title"><h2>Услуги</h2></div><div class="record-editor-procedure-list" data-editor-procedures></div><button type="button" class="ui-button" data-editor-save>Применить</button></div>`;
  const m = mountModal(document.body, modal(content, { title: 'Услуги', className: 'record-editor-modal' })); if (!m) return;
  const render = () => { const host = m.querySelector('[data-editor-procedures]'); host.innerHTML = items.map((item) => `<button type="button" class="record-procedure-row${selected.has(item.id) ? ' is-selected' : ''}" data-editor-procedure="${escapeHtml(item.id)}" aria-pressed="${selected.has(item.id)}"><span class="record-procedure-check" aria-hidden="true"></span><span class="record-procedure-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(String(item.duration || 0))} мин</small></span></button>`).join('') || '<div class="muted">Услуг пока нет.</div>'; initMultiSelect(host, { selectedValues: [...selected], selector: '[data-editor-procedure]', valueAttribute: 'editorProcedure', onChange: (values) => { selected.clear(); values.forEach((id) => selected.add(id)); } }); };
  m.querySelector('[data-editor-save]')?.addEventListener('click', () => { state.procedures = items.filter((item) => selected.has(item.id)).map((item) => ({ id: item.id, name: item.name, cost: item.cost ?? '', duration: Number(item.duration) || 0 })); m.remove(); parent(); }); render();
}

function confirmDelete(record, onDone) {
  const content = `<div class="record-editor-screen record-editor-screen--confirm"><div class="modal-title"><h2>Удалить запись?</h2></div><p>Запись будет удалена и освободит это время.</p><div class="record-editor-actions"><button type="button" class="ui-button ui-button--secondary" data-delete-no>Нет</button><button type="button" class="ui-button" data-delete-yes>Удалить</button></div></div>`;
  const m = mountModal(document.body, modal(content, { title: 'Удалить запись', className: 'record-editor-modal' })); if (!m) return;
  m.querySelector('[data-delete-no]')?.addEventListener('click', () => m.remove());
  m.querySelector('[data-delete-yes]')?.addEventListener('click', () => { if (!deleteRecord(record.id)) return; m.remove(); onDone?.(); });
}

export function openRecordEditor(record, { onClose = () => {} } = {}) {
  if (!record) return;
  const original = JSON.parse(JSON.stringify(record));
  const state = { date: record.date, workplaceId: record.workplaceId, from: record.from, to: record.to, client: record.client || null, procedures: Array.isArray(record.procedures) ? record.procedures.map((item) => ({ ...item })) : [] };
  const render = () => {
    const client = state.client || {};
    const workplace = findWorkplace(state.workplaceId);
    const name = clientName(client);
    const phone = client.phone || client.phones?.[0] || '';
    const procedureNames = state.procedures.map((item) => item?.name).filter(Boolean);
    const top = `<div class="record-card-topline"><button type="button" class="record-card-workplace record-editor-field" data-editor-open-workplace>${escapeHtml(workplace?.name || 'Место работы')}</button><button type="button" class="record-card-datetime record-editor-field" data-editor-open-datetime><span>${escapeHtml(formatDate(state.date))}</span><span>${escapeHtml(state.from || '')}–${escapeHtml(state.to || '')}</span></button></div>`;
    const clientBlock = `<button type="button" class="record-card-client record-editor-field" data-editor-open-client><strong>${client.id ? `${escapeHtml(client.id)} ` : ''}${escapeHtml(name)}</strong>${phone ? `<span>${escapeHtml(phone)}</span>` : ''}</button>`;
    const procedureBlock = `<button type="button" class="record-card-procedures record-editor-field" data-editor-open-procedures>${procedureNames.length ? procedureNames.map((item) => `<span>${escapeHtml(item)}</span>`).join('') : '<span>Добавить услугу</span>'}</button>`;
    const card = entityCard({ top: `${top}${clientBlock}`, bottom: '', right: procedureBlock, className: 'entity-card--record', data: 'data-record-card' });
    const content = `<div class="record-view"><div class="record-view-card">${card}</div><div class="record-view-actions"><button type="button" class="ui-button ui-button--small record-delete-button" data-editor-delete>Удалить</button><button type="button" class="ui-button record-apply-button" data-editor-apply>Применить</button></div></div>`;
    const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--view' })); if (!m) return;
    const rerender = () => { m.remove(); render(); };
    m.querySelector('[data-editor-open-workplace]')?.addEventListener('click', () => { m.remove(); openWorkplaceEditor(render, state); });
    m.querySelector('[data-editor-open-client]')?.addEventListener('click', () => { m.remove(); openClientEditor(render, state); });
    m.querySelector('[data-editor-open-datetime]')?.addEventListener('click', () => { m.remove(); openDateEditor(() => openTimeEditor(render, state, original), state); });
    m.querySelector('[data-editor-open-procedures]')?.addEventListener('click', () => { m.remove(); openProceduresEditor(render, state); });
    m.querySelector('[data-editor-delete]')?.addEventListener('click', () => confirmDelete(record, () => { m.remove(); onClose?.(); }));
    m.querySelector('[data-editor-apply]')?.addEventListener('click', () => { const next = updateRecord(record.id, { date: state.date, workplaceId: state.workplaceId, from: state.from, to: state.to, client: state.client, procedures: state.procedures }); if (!next) { alert('Не удалось сохранить изменения: выбранное время занято или не входит в рабочий день.'); return; } m.remove(); onClose?.(); });
    m.addEventListener('modal:close', () => onClose?.(), { once: true });
  };
  render();
}
