import { entityCard, mountModal, modal, timePicker, initTimePickers } from '../ui/ui.js';
import { createRecord } from '../core/record.js';

const people = () => {
  try {
    const value = JSON.parse(localStorage.getItem('book.people') || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};

const procedures = () => {
  try {
    const value = JSON.parse(localStorage.getItem('book.procedures') || '[]');
    return Array.isArray(value) ? value.filter((item) => !item.deletedAt) : [];
  } catch { return []; }
};

const clientName = (person) => [person?.name, person?.surname].filter(Boolean).join(' ') || 'Без имени';
const durationText = (minutes) => { const m = Number(minutes) || 0; const h = Math.floor(m / 60); const min = m % 60; return h ? `${h} ч${min ? ` ${min} мин` : ''}` : `${min} мин`; };

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function nextFiveMinutes(from) {
  const match = String(from || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return [];
  const start = Number(match[1]) * 60 + Number(match[2]);
  const hourEnd = Math.floor(start / 60) * 60 + 60;
  const result = [];
  for (let value = Math.ceil(start / 5) * 5; value < hourEnd; value += 5) {
    result.push(`${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`);
  }
  return result;
}

function openTimeModal({ date, workplaceId, from, to, onCreated }) {
  const values = nextFiveMinutes(from);
  const times = values.map((value) => `<button type="button" class="record-time-option${/:(00|15|30|45)$/.test(value) ? ' is-quarter' : ''}" data-record-time="${value}">${value}</button>`).join('');
  const toggle = `<div class="segment-control segment-control--two" data-record-mode><button type="button" class="is-active" data-record-mode-value="record">Создать запись</button><button type="button" data-record-mode-value="block">Занять время</button></div>`;
  const content = `${toggle}<div class="record-time-list">${times || '<div class="muted">Нет доступного времени</div>'}</div>`;
  const m = mountModal(document.body, modal(content));
  if (!m) return;
  m.querySelectorAll('[data-record-mode-value]').forEach((buttonNode) => buttonNode.addEventListener('click', () => {
    m.querySelectorAll('[data-record-mode-value]').forEach((item) => item.classList.toggle('is-active', item === buttonNode));
    if (buttonNode.dataset.recordModeValue === 'block') {
      m.querySelector('.record-time-list').innerHTML = '<div class="muted">«Занять время» — отдельный путь и пока не создаёт Запись.</div>';
    } else {
      m.querySelector('.record-time-list').innerHTML = times || '<div class="muted">Нет доступного времени</div>';
    }
  }));
  m.querySelectorAll('[data-record-time]').forEach((buttonNode) => buttonNode.addEventListener('click', () => {
    const selected = buttonNode.dataset.recordTime;
    m.remove();
    openProceduresModal({ date, workplaceId, from: selected, to, onCreated });
  }));
}

function openProceduresModal({ date, workplaceId, from, to, onCreated }) {
  const items = procedures();
  const selected = new Map();
  const render = (m) => {
    const rows = items.map((procedure) => `<div class="record-procedure-row"><label><input type="checkbox" data-procedure-select="${procedure.id}"><span><strong>${procedure.name}</strong><small>${durationText(procedure.duration)}</small></span></label><button type="button" class="icon-button" data-procedure-settings="${procedure.id}" aria-label="Настройки">⚙</button></div>`).join('');
    const selectedCount = selected.size;
    m.querySelector('[data-record-procedures]').innerHTML = rows || '<div class="muted">Процедур пока нет.</div>';
    m.querySelector('[data-record-next]').disabled = selectedCount === 0;
    const reset = m.querySelector('[data-record-reset]');
    reset.hidden = selectedCount === 0;
    m.querySelectorAll('[data-procedure-select]').forEach((checkbox) => {
      checkbox.checked = selected.has(checkbox.dataset.procedureSelect);
      checkbox.addEventListener('change', () => {
        const procedure = items.find((item) => item.id === checkbox.dataset.procedureSelect);
        if (!procedure) return;
        if (checkbox.checked) selected.set(procedure.id, { procedure, cost: defaultCost(procedure), duration: Number(procedure.duration) || 0 });
        else selected.delete(procedure.id);
        render(m);
      });
    });
    m.querySelectorAll('[data-procedure-settings]').forEach((buttonNode) => buttonNode.addEventListener('click', () => openProcedureSettings(m, items.find((item) => item.id === buttonNode.dataset.procedureSettings), selected)));
  };
  const content = `<div class="record-modal-toolbar"><strong>Процедуры</strong><button type="button" class="icon-button icon-button--primary" data-record-add aria-label="Добавить процедуру">+</button></div><div data-record-procedures></div><button type="button" class="ui-button ui-button--secondary record-reset" data-record-reset hidden>Сброс выбора</button><div class="record-modal-next"><button type="button" class="ui-button" data-record-next disabled>Далее →</button></div>`;
  const m = mountModal(document.body, modal(content));
  if (!m) return;
  m.querySelector('[data-record-add]').addEventListener('click', () => {});
  m.querySelector('[data-record-reset]').addEventListener('click', () => { selected.clear(); render(m); });
  m.querySelector('[data-record-next]').addEventListener('click', () => {
    if (!selected.size) return;
    m.remove();
    openClientModal({ date, workplaceId, from, to, procedures: [...selected.values()], onCreated });
  });
  render(m);
}

function defaultCost(procedure) {
  const workplace = procedure?.workplaces?.[0];
  const cost = workplace?.cost;
  if (!cost || cost.free) return '';
  return cost.amount ?? cost.from ?? '';
}

function openProcedureSettings(parent, procedure, selected) {
  if (!procedure) return;
  const current = selected.get(procedure.id) || { procedure, cost: defaultCost(procedure), duration: Number(procedure.duration) || 0 };
  const html = `<h2>${procedure.name}</h2><div class="record-setting-note">установите необходимые параметры услуги для данной записи</div><div class="record-setting-row"><span>Стоимость</span><input inputmode="decimal" data-record-cost value="${current.cost === '' ? '' : `${current.cost} ₽`}"></div><div class="record-setting-row"><span>Длительность</span>${timePicker({ name: 'recordDuration', label: '', value: `${String(Math.floor(current.duration / 60)).padStart(2, '0')}:${String(current.duration % 60).padStart(2, '0')}`, minuteStep: 5 })}</div><div class="record-setting-actions"><button type="button" class="ui-button ui-button--secondary" data-record-cancel>Отмена</button><button type="button" class="ui-button" data-record-save>Сохранить</button></div>`;
  const m = mountModal(document.body, modal(html));
  if (!m) return;
  initTimePickers(m);
  m.querySelector('[data-record-cancel]').addEventListener('click', () => m.remove());
  m.querySelector('[data-record-save]').addEventListener('click', () => {
    const rawCost = String(m.querySelector('[data-record-cost]')?.value || '').replace(/[^0-9.,-]/g, '').replace(',', '.');
    const durationValue = m.querySelector('[data-time-value]')?.value || '';
    const match = durationValue.match(/^(\d{1,2}):(\d{2})$/);
    const duration = match ? Number(match[1]) * 60 + Number(match[2]) : current.duration;
    selected.set(procedure.id, { procedure, cost: rawCost === '' ? '' : Number(rawCost), duration });
    m.remove();
    const check = parent.querySelector(`[data-procedure-select="${procedure.id}"]`);
    if (check) check.checked = true;
    parent.querySelector('[data-record-next]').disabled = selected.size === 0;
  });
}

function openClientModal({ date, workplaceId, from, to, procedures: selectedProcedures, onCreated }) {
  const all = people();
  let filtered = all;
  const content = `<div class="record-client-toolbar"><input class="record-client-search" data-record-client-search placeholder="⌕  Найти клиента..." autocomplete="off"><button type="button" class="icon-button icon-button--primary" data-record-add-client aria-label="Добавить клиента">+</button></div><div class="record-client-list" data-record-client-list></div><div class="record-modal-next"><button type="button" class="ui-button" data-record-client-next disabled>Далее →</button></div>`;
  const m = mountModal(document.body, modal(content));
  if (!m) return;
  let selectedClient = null;
  const render = () => {
    m.querySelector('[data-record-client-list]').innerHTML = filtered.map((person) => entityCard({ id: person.id, title: clientName(person), subtitle: person.phones?.[0] || '', image: person.photo || '', initial: clientName(person).slice(0, 1).toUpperCase(), interactive: true, data: `data-record-client="${person.key}"`, className: `entity-card--compact${selectedClient?.key === person.key ? ' is-selected' : ''}` })).join('') || '<div class="muted">Клиенты не найдены.</div>';
    m.querySelectorAll('[data-record-client]').forEach((card) => card.addEventListener('click', () => { selectedClient = all.find((person) => person.key === card.dataset.recordClient) || null; render(); m.querySelector('[data-record-client-next]').disabled = !selectedClient; }));
  };
  m.querySelector('[data-record-client-search]').addEventListener('input', (event) => { const q = event.target.value.trim().toLocaleLowerCase('ru'); filtered = all.filter((person) => clientName(person).toLocaleLowerCase('ru').includes(q) || String(person.phones?.[0] || '').includes(q)); render(); });
  m.querySelector('[data-record-add-client]').addEventListener('click', () => {});
  m.querySelector('[data-record-client-next]').addEventListener('click', () => {
    if (!selectedClient) return;
    createRecord({ date: dateKey(date), workplaceId, from, to, client: { key: selectedClient.key, id: selectedClient.id || '', name: selectedClient.name || '', surname: selectedClient.surname || '', phone: selectedClient.phones?.[0] || '' }, procedures: selectedProcedures.map(({ procedure, cost, duration }) => ({ id: procedure.id, name: procedure.name, cost, duration })) });
    m.remove();
    onCreated?.();
  });
  render();
}

export function openRecordCreation(options = {}) {
  openTimeModal(options);
}
