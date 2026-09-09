import { button, durationText, escapeHtml, iconButton, list, listEntry, stateView, initStateView, initCalendar, mountModal, modal, timePicker, initTimePickers, initMultiSelect, viewNavigation, initViewNavigation } from '../ui/ui.js';
import { createRecord, getRecords } from './record-data.js';
import { getJournalBreaks, createJournalBreak } from './break-data.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { openClientCreate } from '../main/clients/create.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { openProcedureForm } from '../settings/service/procedures/form.js';
import { isTimeRangeAvailable, getTimeUsages } from '../core/time-usage.js';
import { timeToMinutes, minutesToTime } from '../core/time.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';

const RECORD_MODES = [
  { id: 'record', label: 'Создать запись' },
  { id: 'block', label: 'Занять время' },
];

const people = () => getAllClients();
const procedures = () => getProcedures();
const clientName = (person) => clientDisplay(person).name;

function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function scopedUsages(date, workplaceId) {
  const day = dateKey(date);
  return getTimeUsages({
    records: getRecords().filter((item) => item?.date === day && item?.workplaceId === String(workplaceId || '')),
    breaks: getJournalBreaks().filter((item) => item?.date === day && item?.workplaceId === String(workplaceId || '')),
  });
}

function nextFiveMinutes(from) {
  const start = timeToMinutes(from);
  if (start == null) return [];
  const hourStart = Math.floor(start / 60) * 60;
  const hourEnd = hourStart + 60;
  const result = [];
  for (let value = Math.ceil(start / 5) * 5; value < hourEnd; value += 5) result.push(minutesToTime(value));
  return result;
}

function flowHost(modalRoot) {
  return modalRoot?.querySelector('[data-record-flow-host]') || null;
}

function renderFlow(modalRoot, content) {
  const host = flowHost(modalRoot);
  if (!host) return null;
  host.innerHTML = String(content || '');
  return host;
}

function renderTimeStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  let activeMode = 'record';
  const usages = scopedUsages(date, workplaceId);
  const values = nextFiveMinutes(from).filter((value) => isTimeRangeAvailable({
    from: value,
    to: minutesToTime(timeToMinutes(value) + 5),
    usages,
  }));
  const times = values.map((value) => `<button type="button" class="record-time-option${/:(00|15|30|45)$/.test(value) ? ' is-quarter' : ''}" data-record-time="${value}">${value}</button>`).join('');
  const toggle = viewNavigation({ views: RECORD_MODES, activeView: activeMode, className: 'segment-control--two', ariaLabel: 'Режим записи' });
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--time">${toggle}<div class="record-time-list">${times || '<div class="muted">Нет свободного времени</div>'}</div></div>`);
  if (!host) return;

  host.querySelectorAll('[data-record-time]').forEach((node) => node.addEventListener('click', () => {
    const selected = node.dataset.recordTime;
    if (activeMode === 'block') {
      renderBlockEndStep(modalRoot, { date, workplaceId, from: selected, onCreated });
      return;
    }
    renderProceduresStep(modalRoot, { date, workplaceId, from: selected, to, onCreated });
  }));

  initViewNavigation(host, {
    views: RECORD_MODES,
    activeView: activeMode,
    onChange: (nextMode) => {
      if (!RECORD_MODES.some((item) => item.id === nextMode)) return;
      activeMode = nextMode;
    },
  });
}

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
    assignmentCost.amount !== '' && assignmentCost.amount != null ||
    assignmentCost.from !== '' && assignmentCost.from != null ||
    assignmentCost.to !== '' && assignmentCost.to != null
  ) ? assignmentCost : procedureCost;
  if (!cost || cost.free) return '';
  if (typeof cost === 'number' || typeof cost === 'string') return cost;
  return cost.amount ?? cost.from ?? '';
}

function renderProceduresStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  let items = procedures().filter((procedure) => procedureForWorkplace(procedure, workplaceId));
  const selected = new Map();
  let selectionController = null;
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--procedures"><div class="record-modal-toolbar"><strong>Процедуры</strong>${iconButton('+', { className: 'icon-button--primary', data: 'data-record-add', aria: 'Добавить процедуру' })}</div><div data-record-procedures></div><div class="record-modal-actions modal-actions" data-record-actions></div></div>`);
  if (!host) return;

  const syncActions = () => {
    const hasSelection = selected.size > 0;
    const actions = host.querySelector('[data-record-actions]');
    if (!actions) return;
    actions.innerHTML = hasSelection
      ? `${button('Сброс выбора', { data: 'data-record-reset', variant: 'secondary' })}${button('Далее →', { data: 'data-record-next' })}`
      : '';
    if (!hasSelection) return;

    actions.querySelector('[data-record-reset]')?.addEventListener('click', () => {
      selected.clear();
      selectionController?.setSelectedValues([]);
    });
    actions.querySelector('[data-record-next]')?.addEventListener('click', () => {
      const duration = [...selected.values()].reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
      const end = minutesToTime(timeToMinutes(from) + duration);
      const usages = scopedUsages(date, workplaceId);
      if (!isTimeRangeAvailable({ from, to: end, usages })) {
        alert('Это время уже занято.');
        return;
      }
      renderClientStep(modalRoot, {
        date,
        workplaceId,
        from,
        to: end,
        procedures: [...selected.values()],
        onCreated,
      });
    });
  };

  const render = () => {
    const listHost = host.querySelector('[data-record-procedures]');
    if (!listHost) return;
    listHost.innerHTML = list({
      items: items.map((procedure) => {
        const cost = defaultCost(procedure, workplaceId);
        return {
          title: procedure.name || '',
          secondary: [durationText(procedure.duration), cost !== '' ? `${cost} ₽` : ''],
          interactive: true,
          data: `data-procedure-select="${escapeHtml(procedure.id)}"`,
          aria: `Выбрать процедуру ${procedure.name || ''}`,
          selected: selected.has(procedure.id),
        };
      }),
    }) || '<div class="muted">Процедур для этого места работы пока нет.</div>';
    syncActions();
    selectionController?.destroy();
    selectionController = initMultiSelect(listHost, {
      selectedValues: [...selected.keys()],
      selector: '[data-procedure-select]',
      valueAttribute: 'procedureSelect',
      onChange: (values) => {
        const next = new Map();
        values.forEach((id) => {
          const procedure = items.find((item) => item.id === id);
          if (procedure) next.set(id, selected.get(id) || {
            procedure,
            cost: defaultCost(procedure, workplaceId),
            duration: Number(procedure.duration) || 0,
          });
        });
        selected.clear();
        next.forEach((value, id) => selected.set(id, value));
        render();
      },
    });
  };

  host.querySelector('[data-record-add]')?.addEventListener('click', () => {
    openProcedureForm({
      root: document.body,
      defaultWorkplaceId: workplaceId,
      variant: 'large',
      surface: 'app',
      onSaved: (procedure) => {
        items = procedures().filter((item) => procedureForWorkplace(item, workplaceId));
        if (procedureForWorkplace(procedure, workplaceId)) {
          selected.set(procedure.id, {
            procedure,
            cost: defaultCost(procedure, workplaceId),
            duration: Number(procedure.duration) || 0,
          });
        }
        render();
      },
    });
  });
  render();
}

function openProcedureSettings({ procedure, current, onSave }) {
  if (!procedure) return;
  const value = current || { procedure, cost: defaultCost(procedure, ''), duration: Number(procedure.duration) || 0 };
  const html = `<div class="record-setting-title">${escapeHtml(procedure.name)}</div><div class="record-setting-note">установите необходимые параметры услуги для данной записи</div><div class="record-setting-row"><span>Стоимость</span><input inputmode="decimal" data-record-cost value="${value.cost === '' ? '' : `${value.cost} ₽`}"></div><div class="record-setting-row"><span>Длительность</span>${timePicker({ name: 'recordDuration', label: '', value: `${String(Math.floor(value.duration / 60)).padStart(2, '0')}:${String(value.duration % 60).padStart(2, '0')}`, minuteStep: 5 })}</div><div class="record-setting-actions">${button('Отмена', { data: 'data-record-cancel', variant: 'secondary' })}${button('Сохранить', { data: 'data-record-save' })}</div>`;
  const m = mountModal(document.body, modal(`<div class="record-screen record-screen--settings">${html}</div>`, { className: 'record-modal record-modal--panel' }));
  if (!m) return;
  initTimePickers(m);
  m.querySelector('[data-record-cancel]')?.addEventListener('click', () => m.remove());
  m.querySelector('[data-record-save]')?.addEventListener('click', () => {
    const rawCost = String(m.querySelector('[data-record-cost]')?.value || '').replace(/[^0-9.,-]/g, '').replace(',', '.');
    const timeValue = m.querySelector('[data-time-value]')?.value || '';
    const match = timeValue.match(/^(\d{1,2}):(\d{2})$/);
    onSave?.({
      procedure,
      cost: rawCost === '' ? '' : Number(rawCost),
      duration: match ? Number(match[1]) * 60 + Number(match[2]) : value.duration,
    });
    m.remove();
  });
}

function renderClientStep(modalRoot, { date, workplaceId, from, to, procedures: selectedProcedures, onCreated, onSelected }) {
  let all = people();
  let filtered = all;
  let selectedClient = null;
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--clients"><div class="record-client-toolbar"><input class="record-client-search" data-record-client-search placeholder="🔍 Найти клиента..." autocomplete="off">${iconButton('+', { className: 'icon-button--primary', data: 'data-record-add-client', aria: 'Добавить клиента' })}</div><div class="record-client-list" data-record-client-list></div></div>`);
  if (!host) return;

  const openSelectedClient = (person) => {
    selectedClient = person;
    if (!selectedClient) return;
    if (onSelected) {
      onSelected(selectedClient);
      return;
    }
    renderConfirmationStep(modalRoot, {
      date,
      workplaceId,
      from,
      to,
      selectedClient,
      selectedProcedures,
      onCreated,
    });
  };

  const render = () => {
    const listHost = host.querySelector('[data-record-client-list]');
    if (!listHost) return;
    listHost.innerHTML = list({
      items: filtered.map((person) => {
        const display = clientDisplay(person);
        return {
          overline: display.uei,
          title: display.name,
          secondary: display.phone,
          interactive: true,
          data: `data-record-client="${escapeHtml(person.key)}"`,
          selected: selectedClient?.key === person.key,
          aria: `Выбрать клиента ${display.name}`,
        };
      }),
    }) || '<div class="muted">Клиенты не найдены.</div>';

    listHost.querySelectorAll('[data-record-client]').forEach((row) => row.addEventListener('click', () => {
      openSelectedClient(all.find((person) => person.key === row.dataset.recordClient) || null);
    }));
  };

  host.querySelector('[data-record-client-search]')?.addEventListener('input', (event) => {
    const q = event.target.value.trim().toLocaleLowerCase('ru');
    filtered = all.filter((person) => {
      const display = clientDisplay(person);
      return display.name.toLocaleLowerCase('ru').includes(q) || display.phone.includes(q) || display.uei.toLocaleLowerCase('ru').includes(q);
    });
    render();
  });
  host.querySelector('[data-record-add-client]')?.addEventListener('click', () => {
    openClientCreate({
      root: document.body,
      variant: 'large',
      surface: 'app',
      onCreated: (person) => {
        all = people();
        filtered = all;
        openSelectedClient(all.find((item) => item.key === person.key) || person);
      },
    });
  });
  render();
}

function workingDatesForWorkplace(workplaceId) {
  return getDays()
    .filter((item) => String(item?.workplaceId || '') === String(workplaceId || '') && item?.date)
    .map((item) => item.date)
    .sort();
}

function openConfirmationWorkplaceModal({ workplaceId, onSelected }) {
  const workplaces = getWorkplaces();
  const content = `<div class="record-screen record-screen--workplaces"><div class="record-modal-toolbar"><strong>Выбрать салон</strong></div><div data-record-workplaces>${workplaces.map((workplace) => listEntry({ title: workplace.name || workplace.title || 'Без названия', interactive: true, data: `data-record-workplace="${escapeHtml(workplace.key || workplace.id || '')}"`, aria: `Выбрать салон ${workplace.name || workplace.title || ''}`, className: String(workplace.key || workplace.id || '') === String(workplaceId || '') ? 'is-selected' : '' })).join('') || '<div class="muted">Салоны не найдены.</div>'}</div></div>`;
  const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--full' }));
  if (!m) return;
  m.querySelectorAll('[data-record-workplace]').forEach((row) => row.addEventListener('click', () => {
    const selectedId = row.dataset.recordWorkplace || workplaceId;
    m.remove();
    onSelected?.(selectedId);
  }));
}

function openConfirmationDateModal({ workplaceId, date, onSelected }) {
  const workingDates = workingDatesForWorkplace(workplaceId);
  const current = date instanceof Date ? date : new Date(`${String(date || workingDates[0] || dateKey(new Date()))}T00:00:00`);
  const m = mountModal(document.body, modal(`<div class="record-screen record-screen--date"><div class="record-modal-toolbar"><strong>Выбор даты</strong></div><div data-record-confirm-calendar></div></div>`, { className: 'record-modal record-modal--full' }));
  if (!m) return;
  const calendarRoot = m.querySelector('[data-record-confirm-calendar]');
  initCalendar(calendarRoot, {
    month: new Date(current.getFullYear(), current.getMonth(), 1),
    workingDates,
    onDateSelect: (selectedDate) => {
      if (!workingDates.includes(selectedDate)) return;
      m.remove();
      onSelected?.(selectedDate);
    },
  });
}

function availableConfirmationTimes({ date, workplaceId, duration }) {
  const day = getDay(getDays(), workplaceId, date);
  const workTime = getDayTime(day, getWorkplaces());
  if (!workTime) return [];
  const start = timeToMinutes(workTime.from);
  const end = timeToMinutes(workTime.to);
  if (start == null || end == null) return [];
  const appointmentDuration = Math.max(1, Number(duration) || 0);
  const first = Math.ceil(start / 30) * 30;
  const result = [];
  for (let value = first; value + appointmentDuration <= end; value += 30) {
    const from = minutesToTime(value);
    const to = minutesToTime(value + appointmentDuration);
    if (isTimeRangeAvailable({ from, to, usages: scopedUsages(date, workplaceId) })) result.push({ from, to });
  }
  return result;
}

function openConfirmationTimeModal({ date, workplaceId, from, duration, onSelected }) {
  const options = availableConfirmationTimes({ date, workplaceId, duration });
  const content = `<div class="record-screen record-screen--time"><div class="record-modal-toolbar"><strong>Выбор времени</strong></div><div class="record-time-list">${options.map((item) => `<button type="button" class="record-time-option" data-record-confirm-time-option="${item.from}">${item.from}</button>`).join('') || '<div class="muted">Свободного времени нет.</div>'}</div></div>`;
  const m = mountModal(document.body, modal(content, { className: 'record-modal record-modal--full' }));
  if (!m) return;
  m.querySelectorAll('[data-record-confirm-time-option]').forEach((node) => node.addEventListener('click', () => {
    const selectedFrom = node.dataset.recordConfirmTimeOption || from;
    m.remove();
    onSelected?.(selectedFrom);
  }));
}

function renderConfirmationStep(modalRoot, { date, workplaceId, from, to, selectedClient, selectedProcedures, onCreated }) {
  let currentDate = dateKey(date);
  let currentWorkplaceId = workplaceId;
  let currentFrom = from;
  let currentTo = to;
  let currentClient = selectedClient;

  const duration = () => selectedProcedures.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
  const totalCost = () => selectedProcedures.reduce((sum, entry) => {
    const value = Number(entry.cost);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const chooseDateAfterWorkplace = (nextWorkplaceId) => {
    currentWorkplaceId = nextWorkplaceId;
    openConfirmationDateModal({
      workplaceId: currentWorkplaceId,
      date: currentDate,
      onSelected: (nextDate) => {
        currentDate = nextDate;
        openConfirmationTimeModal({
          date: currentDate,
          workplaceId: currentWorkplaceId,
          from: currentFrom,
          duration: duration(),
          onSelected: (nextFrom) => {
            currentFrom = nextFrom;
            currentTo = minutesToTime(timeToMinutes(currentFrom) + duration());
            render();
          },
        });
      },
    });
  };

  const chooseDate = () => openConfirmationDateModal({
    workplaceId: currentWorkplaceId,
    date: currentDate,
    onSelected: (nextDate) => {
      currentDate = nextDate;
      openConfirmationTimeModal({
        date: currentDate,
        workplaceId: currentWorkplaceId,
        from: currentFrom,
        duration: duration(),
        onSelected: (nextFrom) => {
          currentFrom = nextFrom;
          currentTo = minutesToTime(timeToMinutes(currentFrom) + duration());
          render();
        },
      });
    },
  });

  const chooseTime = () => openConfirmationTimeModal({
    date: currentDate,
    workplaceId: currentWorkplaceId,
    from: currentFrom,
    duration: duration(),
    onSelected: (nextFrom) => {
      currentFrom = nextFrom;
      currentTo = minutesToTime(timeToMinutes(currentFrom) + duration());
      render();
    },
  });

  const render = () => {
    const host = flowHost(modalRoot);
    if (!host) return;
    const client = clientDisplay(currentClient);
    const workplace = findWorkplaceName(currentWorkplaceId);
    const formattedDate = formatConfirmationDate(currentDate);
    const procedureItems = selectedProcedures.map((item) => ({
      title: item.procedure.name || '',
      right: item.cost === '' || item.cost === null || item.cost === undefined ? '' : `${item.cost} ₽`,
    }));
    const total = totalCost();
    const view = stateView({
      blocks: [
        { id: 'workplace', rows: [{ title: workplace }], aria: `Изменить салон: ${workplace}` },
        { id: 'dateTime', rows: [{ title: formattedDate }, { title: `${currentFrom} - ${currentTo || ''}` }], aria: `Изменить дату и время: ${formattedDate} ${currentFrom} - ${currentTo || ''}` },
        { id: 'client', rows: [...(client.uei ? [{ title: client.uei }] : []), { title: client.name }, { title: client.phone }], aria: `Изменить клиента: ${client.name}` },
        { id: 'procedures', kind: 'list', items: procedureItems, summary: { left: durationText(duration()), right: `${total} ₽` }, aria: 'Изменить процедуры' },
      ],
      actions: [{ label: 'Подтвердить запись', data: 'data-record-confirm' }],
      className: 'record-state-view',
    });

    host.innerHTML = `<div class="record-screen record-screen--state-view">${view}</div>`;
    initStateView(host.querySelector('[data-state-view]'), {
      onBlockSelect: (blockId) => {
        if (blockId === 'workplace') {
          openConfirmationWorkplaceModal({ workplaceId: currentWorkplaceId, onSelected: chooseDateAfterWorkplace });
          return;
        }
        if (blockId === 'dateTime') {
          chooseDate();
          return;
        }
        if (blockId === 'client') {
          renderClientStep(modalRoot, {
            date: currentDate,
            workplaceId: currentWorkplaceId,
            from: currentFrom,
            to: currentTo,
            procedures: selectedProcedures,
            onCreated,
            onSelected: (client) => {
              currentClient = client;
              render();
            },
          });
        }
      },
      onRowSelect: (blockId, rowIndex) => {
        if (blockId === 'dateTime') {
          if (rowIndex === 0) {
            chooseDate();
            return;
          }
          if (rowIndex === 1) {
            chooseTime();
            return;
          }
        }
        if (blockId !== 'procedures' || rowIndex === 'summary') return;
        const index = Number(rowIndex);
        const item = selectedProcedures[index];
        if (!item) return;
        openProcedureSettings({
          procedure: item.procedure,
          current: item,
          onSave: (updated) => {
            selectedProcedures[index] = updated;
            currentTo = minutesToTime(timeToMinutes(currentFrom) + duration());
            render();
          },
        });
      },
    });

    host.querySelector('[data-record-confirm]')?.addEventListener('click', () => {
      const usages = scopedUsages(currentDate, currentWorkplaceId);
      if (!isTimeRangeAvailable({ from: currentFrom, to: currentTo, usages })) {
        alert('Это время уже занято.');
        return;
      }
      createRecord({
        date: dateKey(currentDate),
        workplaceId: currentWorkplaceId,
        from: currentFrom,
        to: currentTo,
        client: {
          key: currentClient.key,
          id: currentClient.id || '',
          name: currentClient.name || '',
          surname: currentClient.surname || '',
          phone: currentClient.phones?.[0] || '',
        },
        procedures: selectedProcedures.map(({ procedure, cost, duration: itemDuration }) => ({
          id: procedure.id,
          name: procedure.name,
          cost,
          duration: itemDuration,
        })),
      });
      modalRoot.remove();
      onCreated?.();
    });
  };

  render();
}

function blockEndValues({ date, workplaceId, from }) {
  const start = timeToMinutes(from);
  if (start == null) return [];
  const day = getDay(getDays(), workplaceId, date);
  const workTime = getDayTime(day, getWorkplaces());
  const workEnd = timeToMinutes(workTime?.to);
  if (workEnd == null || workEnd <= start) return [];

  const usages = scopedUsages(date, workplaceId);
  const nextUsageStart = usages
    .map((usage) => timeToMinutes(usage?.from))
    .filter((value) => value != null && value > start)
    .reduce((nearest, value) => nearest == null || value < nearest ? value : nearest, null);
  const limit = Math.min(workEnd, nextUsageStart ?? workEnd);
  const values = [];
  for (let value = start + 5; value <= limit; value += 5) {
    const end = minutesToTime(value);
    if (isTimeRangeAvailable({ from, to: end, usages })) values.push(end);
  }
  return values;
}

function renderBlockEndStep(modalRoot, { date, workplaceId, from, onCreated }) {
  const values = blockEndValues({ date, workplaceId, from });
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--time"><div class="record-modal-toolbar"><strong>До скольки занять</strong></div><div class="record-time-list">${values.map((value) => `<button type="button" class="record-time-option" data-block-end="${value}">${value}</button>`).join('') || '<div class="muted">Свободного времени нет.</div>'}</div></div>`);
  if (!host) return;
  host.querySelectorAll('[data-block-end]').forEach((node) => node.addEventListener('click', () => {
    const to = node.dataset.blockEnd;
    renderBreakConfirmationStep(modalRoot, { date, workplaceId, from, to, onCreated });
  }));
}

function renderBreakConfirmationStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  const host = flowHost(modalRoot);
  if (!host) return;
  const workplace = findWorkplaceName(workplaceId);
  const formattedDate = formatConfirmationDate(date);
  const view = stateView({
    blocks: [
      { id: 'workplace', rows: [{ title: workplace }] },
      { id: 'dateTime', rows: [{ title: formattedDate }, { title: `${from} - ${to}` }] },
    ],
    actions: [{ label: 'Подтвердить перерыв', data: 'data-break-confirm' }],
    className: 'record-state-view',
  });
  host.innerHTML = `<div class="record-screen record-screen--state-view">${view}</div>`;
  host.querySelector('[data-break-confirm]')?.addEventListener('click', () => {
    const day = getDay(getDays(), workplaceId, date);
    const workTime = getDayTime(day, getWorkplaces());
    const start = timeToMinutes(from);
    const end = timeToMinutes(to);
    const workStart = timeToMinutes(workTime?.from);
    const workEnd = timeToMinutes(workTime?.to);
    if (start == null || end == null || workStart == null || workEnd == null || start < workStart || end > workEnd || end <= start) {
      alert('Это время находится вне рабочего периода.');
      return;
    }
    if (!isTimeRangeAvailable({ from, to, usages: scopedUsages(date, workplaceId) })) {
      alert('Это время уже занято.');
      return;
    }
    if (!createJournalBreak({ workplaceId: String(workplaceId || ''), date: dateKey(date), from: String(from), to: String(to) })) return;
    modalRoot.remove();
    onCreated?.();
  });
}

function findWorkplaceName(workplaceId) {
  const workplace = getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(workplaceId ?? ''));
  return workplace?.name || workplace?.title || 'Салон красоты';
}

function formatConfirmationDate(date) {
  const value = date instanceof Date ? dateKey(date) : String(date || '');
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : value;
}

export function openRecordCreation(options = {}) {
  const m = mountModal(document.body, modal('<div data-record-flow-host></div>', {
    className: 'record-modal record-modal--flow',
    variant: 'large',
    surface: 'app',
  }));
  if (!m) return;
  renderTimeStep(m, options);
}
