import { button, durationPicker, durationText, entityCard, escapeHtml, list, listEntry, stateView, initStateView, initCalendar, mountModal, modal, openNotice, initDurationPickers, initMultiSelect, viewNavigation, initViewNavigation, workspaceHeaderContext, v2ZLayer, mountV2ZLayer } from '../ui/ui.js';
import { createRecord } from '../core/record/index.js';
import { createJournalBreak } from './break-service.js';
import { getPeople } from '../main/people/data.js';
import { personDisplay } from '../main/people/presentation.js';
import { openPersonCreate } from '../main/people/create.js';
import { openPerson } from '../main/people/people.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { openProcedureForm } from '../settings/service/procedures/form.js';
import { assignProceduresToWorkplace } from '../settings/service/procedures/service.js';
import { checkTimeAvailability, listAvailableEndTimes, listAvailableStartTimes } from '../core/time/index.js';
import { timeToMinutes, minutesToTime } from '../core/time/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../core/workplace-time.js';
import { journalRecordActionContext } from './record-action-context.js';

const RECORD_MODES = [
  { id: 'record', label: 'Создать запись' },
  { id: 'block', label: 'Занять время' },
];

const people = () => getPeople();
const procedures = () => getProcedures();
const personName = (person) => personDisplay(person).name;

function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recordStartTimes({ date, workplaceId, from }) {
  const start = timeToMinutes(from);
  if (start == null) return [];
  const hourEnd = Math.floor(start / 60) * 60 + 60;
  const to = minutesToTime(Math.min(hourEnd, 23 * 60 + 59));
  if (!to) return [];
  return listAvailableStartTimes({
    date,
    workplaceId,
    from,
    to,
    duration: 5,
    step: 5,
  });
}

function recordFlowSurface() {
  return document.querySelector('[data-v2-workspace-surface]') || document.querySelector('[data-v2-app]') || document.body;
}

function pushRecordLayer({ settings = null } = {}) {
  const context = workspaceHeaderContext({
    title: 'Запись',
    a: settings ? {
      kind: 'settings',
      label: 'Настройки записи',
      data: 'data-record-flow-settings',
      aria: 'Настройки записи',
    } : null,
  });
  return mountV2ZLayer(recordFlowSurface(), v2ZLayer(`${context}<div data-record-flow-host></div>`, {
    className: 'record-flow-z',
  }), { stack: true });
}

function flowHost(layerRoot) {
  return layerRoot?.querySelector('[data-record-flow-host]') || null;
}

function renderFlow(layerRoot, content) {
  const host = flowHost(layerRoot);
  if (!host) return null;
  host.innerHTML = String(content || '');
  return host;
}

function setRecordPrimaryAction(layerRoot, { label = '', variant = '', onClick = null } = {}) {
  const context = layerRoot?.querySelector('[data-workspace-header-context]');
  if (!context) return;
  context.querySelector('[data-record-primary-source]')?.remove();
  if (!label || typeof onClick !== 'function') {
    window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
    return;
  }
  const source = document.createElement('button');
  source.type = 'button';
  source.className = 'record-primary-source';
  source.dataset.recordPrimarySource = '';
  source.dataset.v2PrimaryAction = '';
  source.dataset.v2PrimaryLabel = label;
  if (variant) source.dataset.v2PrimaryVariant = variant;
  source.setAttribute('aria-label', label);
  source.addEventListener('click', onClick);
  context.appendChild(source);
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function closeRecordLayers() {
  const layers = [...document.querySelectorAll('[data-v2-z-layer].record-flow-z')].reverse();
  layers.forEach((layer) => layer.v2Close?.());
}

function bindRecordSettings(layerRoot, onOpen) {
  if (typeof onOpen !== 'function') return;
  layerRoot?.querySelector('[data-record-flow-settings]')?.addEventListener('click', onOpen);
}

function openRecordTimeNotice(message) {
  openNotice({ title: 'Недостаточно времени', message });
}

function renderTimeStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  modalRoot ||= pushRecordLayer();
  let activeMode = 'record';
  const values = recordStartTimes({ date: dateKey(date), workplaceId, from });
  const times = values.map((value) => `<button type="button" class="record-time-option${/:(00|15|30|45)$/.test(value) ? ' is-quarter' : ''}" data-record-time="${value}">${value}</button>`).join('');
  const toggle = viewNavigation({ views: RECORD_MODES, activeView: activeMode, className: 'segment-control--two', ariaLabel: 'Режим записи' });
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--time">${toggle}<div class="record-time-list">${times || '<div class="muted">Нет свободного времени</div>'}</div></div>`);
  if (!host) return;

  host.querySelectorAll('[data-record-time]').forEach((node) => node.addEventListener('click', () => {
    const selected = node.dataset.recordTime;
    if (activeMode === 'block') {
      renderBlockEndStep(null, { date, workplaceId, from: selected, onCreated });
      return;
    }
    renderProceduresStep(null, { date, workplaceId, from: selected, to, onCreated });
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

function openPriceProcedurePicker({ workplaceId, onAssigned }) {
  const all = procedures();
  if (!all.length) {
    openNotice({ title: 'Прайс', message: 'В прайсе пока нет процедур. Новую процедуру можно создать через «+».' });
    return;
  }

  const available = all.filter((procedure) => !procedureForWorkplace(procedure, workplaceId));
  if (!available.length) {
    openNotice({ title: 'Прайс', message: 'Все процедуры из прайса уже доступны в этом рабочем месте.' });
    return;
  }

  const selectedIds = new Set();
  const content = list({
    items: available.map((procedure) => {
      const cost = defaultCost(procedure, '');
      return {
        title: procedure.name || '',
        secondary: [durationText(procedure.duration), cost !== '' ? `${cost} ₽` : ''],
        interactive: true,
        data: `data-record-price-procedure="${escapeHtml(procedure.id)}"`,
        aria: `Подключить процедуру ${procedure.name || ''} к рабочему месту`,
      };
    }),
  });
  const m = mountModal(document.body, modal(`<div class="modal-title"><h2>Из прайса</h2><p>Отметьте процедуры, которые выполняются в этом рабочем месте.</p></div><div data-record-price-list>${content}</div><div class="modal-actions">${button('Добавить', { data: 'data-record-price-save' })}</div>`, { variant: 'medium', surface: 'app' }));
  if (!m) return;

  const listRoot = m.querySelector('[data-record-price-list]');
  const controller = initMultiSelect(listRoot, {
    selectedValues: [],
    selector: '[data-record-price-procedure]',
    valueAttribute: 'recordPriceProcedure',
    onChange: (values) => {
      selectedIds.clear();
      values.forEach((id) => selectedIds.add(String(id)));
    },
  });

  m.querySelector('[data-record-price-save]')?.addEventListener('click', () => {
    if (!selectedIds.size) return;
    const workplace = getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(workplaceId || '')) || null;
    const assigned = assignProceduresToWorkplace({
      procedureIds: [...selectedIds],
      workplaceId,
      workplaceName: workplace?.name || workplace?.title || '',
    });
    controller?.destroy();
    m.remove();
    onAssigned?.(assigned);
  });
}

function renderProceduresStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  modalRoot ||= pushRecordLayer({ settings: true });
  let items = procedures().filter((procedure) => procedureForWorkplace(procedure, workplaceId));
  const selected = new Map();
  let selectionController = null;
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--procedures"><div class="record-modal-toolbar"><strong>Процедуры</strong></div><div data-record-procedures></div></div>`);
  if (!host) return;

  const syncActions = () => {
    const hasSelection = selected.size > 0;
    if (!hasSelection) {
      setRecordPrimaryAction(modalRoot);
      return;
    }
    setRecordPrimaryAction(modalRoot, {
      label: 'Далее',
      onClick: () => {
        const duration = [...selected.values()].reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
        const end = minutesToTime(timeToMinutes(from) + duration);
        if (!checkTimeAvailability({ date: dateKey(date), workplaceId, from, to: end }).ok) {
          openRecordTimeNotice('Запись не может быть создана: выбранным процедурам не хватает свободного времени. Скорректируйте время записи.');
          return;
        }
        renderPersonStep(null, {
          date,
          workplaceId,
          from,
          to: end,
          procedures: [...selected.values()],
          onCreated,
        });
      },
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

  bindRecordSettings(modalRoot, () => {
    const menu = list({
      items: [
        { title: 'Из прайса', interactive: true, data: 'data-record-settings-from-price', aria: 'Добавить из прайса' },
        { title: 'Добавить процедуру', interactive: true, data: 'data-record-settings-add-procedure', aria: 'Добавить процедуру' },
      ],
    });
    const m = mountModal(document.body, modal(menu, { variant: 'quick', surface: 'app' }));
    m?.querySelector('[data-record-settings-from-price]')?.addEventListener('click', () => {
      m.v2Close?.();
      openPriceProcedurePicker({
        workplaceId,
        onAssigned: () => {
          items = procedures().filter((item) => procedureForWorkplace(item, workplaceId));
          render();
        },
      });
    });
    m?.querySelector('[data-record-settings-add-procedure]')?.addEventListener('click', () => {
      m.v2Close?.();
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
  });
  render();
}

function openProcedureSettings({ procedure, current, onSave, onAdd }) {
  if (!procedure) return;
  const value = current || { procedure, cost: defaultCost(procedure, ''), duration: Number(procedure.duration) || 0 };
  const addAction = onAdd ? button('+ Добавить процедуру', { data: 'data-record-add-procedure', variant: 'secondary' }) : '';
  const durationField = durationPicker({ name: 'recordDuration', label: 'Время', value: Number(value.duration) || 0 });
  const html = `<div class="modal-title"><h2>${escapeHtml(procedure.name)}</h2><p>Скорректируйте время процедуры для этой записи.</p></div><div class="compact-form">${durationField}<div class="modal-actions">${button('Сохранить', { data: 'data-record-save' })}${addAction}</div></div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  initDurationPickers(m);
  m.querySelector('[data-record-add-procedure]')?.addEventListener('click', () => {
    m.remove();
    onAdd?.();
  });
  m.querySelector('[data-record-save]')?.addEventListener('click', () => {
    const durationValue = Number(m.querySelector('[data-duration-value]')?.value);
    onSave?.({
      procedure,
      cost: value.cost,
      duration: Number.isFinite(durationValue) ? durationValue : value.duration,
    });
    m.remove();
  });
}

function renderPersonStep(modalRoot, { date, workplaceId, from, to, procedures: selectedProcedures, onCreated, onSelected }) {
  modalRoot ||= pushRecordLayer({ settings: true });
  let all = people();
  let filtered = all;
  let selectedPerson = null;
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--people"><div class="record-person-toolbar"><input class="record-person-search" data-record-person-search placeholder="🔍 Найти человека..." autocomplete="off"></div><div class="record-person-list" data-record-person-list></div></div>`);
  if (!host) return;

  const openSelectedPerson = (person) => {
    selectedPerson = person;
    if (!selectedPerson) return;
    if (onSelected) {
      onSelected(selectedPerson);
      return;
    }
    renderConfirmationStep(null, {
      date,
      workplaceId,
      from,
      to,
      selectedPerson,
      selectedProcedures,
      onCreated,
    });
  };

  const render = () => {
    const listHost = host.querySelector('[data-record-person-list]');
    if (!listHost) return;
    listHost.innerHTML = list({
      items: filtered.map((person) => {
        const display = personDisplay(person);
        return {
          overline: display.uei,
          title: display.name,
          secondary: display.phone,
          interactive: true,
          data: `data-record-person="${escapeHtml(person.key)}"`,
          selected: selectedPerson?.key === person.key,
          aria: `Выбрать человека ${display.name}`,
        };
      }),
    }) || '<div class="muted">Люди не найдены.</div>';

    listHost.querySelectorAll('[data-record-person]').forEach((row) => row.addEventListener('click', () => {
      openSelectedPerson(all.find((person) => person.key === row.dataset.recordPerson) || null);
    }));
  };

  host.querySelector('[data-record-person-search]')?.addEventListener('input', (event) => {
    const q = event.target.value.trim().toLocaleLowerCase('ru');
    filtered = all.filter((person) => {
      const display = personDisplay(person);
      return display.name.toLocaleLowerCase('ru').includes(q) || display.phone.includes(q) || display.uei.toLocaleLowerCase('ru').includes(q);
    });
    render();
  });
  bindRecordSettings(modalRoot, () => {
    openPersonCreate({
      root: document.body,
      variant: 'large',
      surface: 'app',
      onCreated: (person) => {
        all = people();
        filtered = all;
        openSelectedPerson(all.find((item) => item.key === person.key) || person);
      },
    });
  });
  render();
}

function openConfirmationWorkplaceModal({ workplaceId, onSelected }) {
  const workplaces = getWorkplaces();
  const items = workplaces.map((workplace) => ({
    title: workplace.name || workplace.title || 'Без названия',
    interactive: true,
    data: `data-record-workplace="${escapeHtml(workplace.key || workplace.id || '')}"`,
    selected: String(workplace.key || workplace.id || '') === String(workplaceId || ''),
    aria: `Выбрать рабочее пространство ${workplace.name || workplace.title || ''}`,
  }));
  const content = `<div class="modal-title"><h2>Рабочее пространство</h2></div>${list({ items }) || '<div class="muted">Рабочие пространства не найдены.</div>'}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-workplace]').forEach((row) => row.addEventListener('click', () => {
    const selectedId = row.dataset.recordWorkplace || workplaceId;
    m.remove();
    onSelected?.(selectedId);
  }));
}

function openConfirmationDateModal({ workplaceId, date, onSelected }) {
  const workingDates = getWorkplaceWorkingDates(workplaceId);
  const current = date instanceof Date ? date : new Date(`${String(date || workingDates[0] || dateKey(new Date()))}T00:00:00`);
  const content = `<div class="modal-title"><h2>Выбор даты</h2></div><div data-record-confirm-calendar></div>`;
  const m = mountModal(document.body, modal(content, { variant: 'large', surface: 'app' }));
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
  return listAvailableStartTimes({
    date,
    workplaceId,
    duration: Math.max(1, Number(duration) || 0),
    step: 15,
  }).map((from) => ({ from, to: minutesToTime(timeToMinutes(from) + Math.max(1, Number(duration) || 0)) }));
}

function openConfirmationTimeModal({ date, workplaceId, from, duration, onSelected }) {
  const options = availableConfirmationTimes({ date, workplaceId, duration });
  const slots = options.map((item) => `<button type="button" class="record-time-option" data-record-confirm-time-option="${item.from}">${item.from}</button>`).join('') || '<div class="muted">Свободного времени нет.</div>';
  const content = `<div class="modal-title"><h2>Выбор времени</h2></div><div class="record-time-list">${slots}</div>`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-confirm-time-option]').forEach((node) => node.addEventListener('click', () => {
    const selectedFrom = node.dataset.recordConfirmTimeOption || from;
    m.remove();
    onSelected?.(selectedFrom);
  }));
}

function openPhoneActions(phone) {
  const value = String(phone || '').trim();
  if (!value) return;
  const content = list({
    items: [
      { title: 'Позвонить', interactive: true, data: 'data-record-phone-call', aria: `Позвонить ${value}` },
      { title: 'Написать', interactive: true, data: 'data-record-phone-write', aria: `Написать ${value}` },
    ],
  });
  const m = mountModal(document.body, modal(content, { variant: 'compact' }));
  if (!m) return;
  m.querySelector('[data-record-phone-call]')?.addEventListener('click', () => {
    window.location.href = `tel:${value.replace(/[^\d+]/g, '')}`;
  });
  m.querySelector('[data-record-phone-write]')?.addEventListener('click', () => {
    m.remove();
    mountModal(document.body, modal('<div class="muted">Чат в разработке</div>', { variant: 'compact' }));
  });
}

function openConfirmationProcedurePicker({ workplaceId, selectedProcedures, onSelected }) {
  const selectedIds = new Set(selectedProcedures.map((item) => String(item?.procedure?.id || '')));
  const available = procedures().filter((procedure) => procedureForWorkplace(procedure, workplaceId) && !selectedIds.has(String(procedure.id || '')));
  const content = list({
    items: available.map((procedure) => ({
      title: procedure.name || '',
      secondary: [durationText(procedure.duration), defaultCost(procedure, workplaceId) !== '' ? `${defaultCost(procedure, workplaceId)} ₽` : ''],
      interactive: true,
      data: `data-record-confirm-add-procedure="${escapeHtml(procedure.id)}"`,
      aria: `Добавить процедуру ${procedure.name || ''}`,
    })),
  }) || '<div class="muted">Других процедур для этого рабочего места нет.</div>';
  const m = mountModal(document.body, modal(`<div class="modal-title"><h2>Добавить процедуру</h2></div>${content}`, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-confirm-add-procedure]').forEach((node) => node.addEventListener('click', () => {
    const procedure = available.find((item) => String(item.id) === String(node.dataset.recordConfirmAddProcedure));
    if (!procedure) return;
    m.remove();
    onSelected?.({
      procedure,
      cost: defaultCost(procedure, workplaceId),
      duration: Number(procedure.duration) || 0,
    });
  }));
}

function renderConfirmationStep(modalRoot, { date, workplaceId, from, to, selectedPerson, selectedProcedures, onCreated }) {
  modalRoot ||= pushRecordLayer();
  let currentDate = dateKey(date);
  let currentWorkplaceId = workplaceId;
  let currentFrom = from;
  let currentTo = to;
  let currentPerson = selectedPerson;

  const duration = () => selectedProcedures.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
  const totalCost = () => selectedProcedures.reduce((sum, entry) => {
    const value = Number(entry.cost);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const calculatedTo = () => minutesToTime(timeToMinutes(currentFrom) + duration());
  const fitsCurrentSlot = (nextDuration = duration()) => {
    const end = minutesToTime(timeToMinutes(currentFrom) + nextDuration);
    return checkTimeAvailability({
      date: currentDate,
      workplaceId: currentWorkplaceId,
      from: currentFrom,
      to: end,
    }).ok;
  };

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
            currentTo = calculatedTo();
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
          currentTo = calculatedTo();
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
      currentTo = calculatedTo();
      render();
    },
  });

  const addProcedure = () => openConfirmationProcedurePicker({
    workplaceId: currentWorkplaceId,
    selectedProcedures,
    onSelected: (item) => {
      const nextDuration = duration() + (Number(item.duration) || 0);
      if (!fitsCurrentSlot(nextDuration)) {
        openRecordTimeNotice('Эта процедура не помещается в свободный интервал. Скорректируйте время записи.');
        return;
      }
      selectedProcedures.push(item);
      currentTo = calculatedTo();
      render();
    },
  });

  const openPerson = () => {
    const key = currentPerson?.key;
    if (!key) return;
    openPerson({
      root: document.body,
      key,
      onClose: () => {
        const updated = people().find((person) => person.key === key);
        if (updated) currentPerson = updated;
        render();
      },
    });
  };

  const render = () => {
    const host = flowHost(modalRoot);
    if (!host) return;
    const person = personDisplay(currentPerson);
    const workplace = findWorkplaceName(currentWorkplaceId);
    const formattedDate = formatConfirmationDate(currentDate);
    const total = totalCost();
    const detailRows = [
      { left: durationText(duration()), right: `${total} ₽`, weight: 'strong' },
      ...selectedProcedures.map((item, index) => ({
        left: item.procedure.name || '',
        right: item.cost === '' || item.cost === null || item.cost === undefined ? '' : `${item.cost} ₽`,
        data: `data-record-confirm-procedure="${index}"`,
        aria: `Изменить время процедуры ${item.procedure.name || ''}`,
      })),
    ];
    const card = entityCard({
      id: person.uei,
      title: person.name,
      subtitle: person.phone,
      idData: person.uei ? 'data-record-confirm-person-profile' : '',
      idAria: person.uei ? `Открыть человека ${person.name}` : '',
      titleData: 'data-record-confirm-person-profile',
      titleAria: `Открыть человека ${person.name}`,
      subtitleData: person.phone ? 'data-record-confirm-phone' : '',
      subtitleAria: person.phone ? `Действия с телефоном ${person.phone}` : '',
      topMeta: [{ value: workplace, row: 1, data: 'data-record-confirm-workplace', aria: `Изменить рабочее пространство ${workplace}` }],
      topRightMeta: [
        { value: formattedDate, row: 2, data: 'data-record-confirm-date', aria: `Изменить дату ${formattedDate}` },
        { value: `${currentFrom} - ${currentTo || ''}`, row: 3, data: 'data-record-confirm-time', aria: `Изменить время ${currentFrom} - ${currentTo || ''}` },
      ],
      detailRows,
      className: 'entity-card--hero entity-card--top-dark',
    });

    host.innerHTML = `<div class="record-screen record-screen--state-view">${card}</div>`;

    host.querySelector('[data-record-confirm-workplace]')?.addEventListener('click', () => {
      openConfirmationWorkplaceModal({ workplaceId: currentWorkplaceId, onSelected: chooseDateAfterWorkplace });
    });
    host.querySelector('[data-record-confirm-date]')?.addEventListener('click', chooseDate);
    host.querySelector('[data-record-confirm-time]')?.addEventListener('click', chooseTime);
    host.querySelectorAll('[data-record-confirm-person-profile]').forEach((node) => node.addEventListener('click', openPerson));
    host.querySelector('[data-record-confirm-phone]')?.addEventListener('click', () => openPhoneActions(person.phone));
    host.querySelectorAll('[data-record-confirm-procedure]').forEach((node) => node.addEventListener('click', () => {
      const index = Number(node.dataset.recordConfirmProcedure);
      const item = selectedProcedures[index];
      if (!item) return;
      openProcedureSettings({
        procedure: item.procedure,
        current: item,
        onAdd: addProcedure,
        onSave: (updated) => {
          const previous = selectedProcedures[index];
          selectedProcedures[index] = updated;
          if (!fitsCurrentSlot()) {
            selectedProcedures[index] = previous;
            openRecordTimeNotice('Новая длительность процедуры не помещается в свободный интервал. Скорректируйте время записи.');
            return;
          }
          currentTo = calculatedTo();
          render();
        },
      });
    }));

    setRecordPrimaryAction(modalRoot, {
      label: 'Подтвердить',
      onClick: () => {
      if (!checkTimeAvailability({
        date: currentDate,
        workplaceId: currentWorkplaceId,
        from: currentFrom,
        to: currentTo,
      }).ok) {
        openRecordTimeNotice('Запись не может быть создана: выбранное время уже занято. Скорректируйте время записи.');
        return;
      }
      createRecord({
        source: 'journal',
        actionContext: journalRecordActionContext(),
        date: dateKey(currentDate),
        workplaceId: currentWorkplaceId,
        from: currentFrom,
        to: currentTo,
        person: {
          key: currentPerson.key,
          id: currentPerson.id || '',
          name: currentPerson.name || '',
          surname: currentPerson.surname || '',
          phone: currentPerson.phones?.[0] || '',
          discountPercent: Number(currentPerson.discountPercent) || 0,
        },
        procedures: selectedProcedures.map(({ procedure, cost, duration: itemDuration }) => ({
          id: procedure.id,
          name: procedure.name,
          cost,
          duration: itemDuration,
        })),
      });
      closeRecordLayers();
      onCreated?.();
      },
    });
  };

  render();
}

function blockEndValues({ date, workplaceId, from }) {
  return listAvailableEndTimes({
    date: dateKey(date),
    workplaceId,
    from,
    step: 5,
  });
}

function renderBlockEndStep(modalRoot, { date, workplaceId, from, onCreated }) {
  modalRoot ||= pushRecordLayer();
  const values = blockEndValues({ date, workplaceId, from });
  const host = renderFlow(modalRoot, `<div class="record-screen record-screen--time"><div class="record-modal-toolbar"><strong>До скольки занять</strong></div><div class="record-time-list">${values.map((value) => `<button type="button" class="record-time-option" data-block-end="${value}">${value}</button>`).join('') || '<div class="muted">Свободного времени нет.</div>'}</div></div>`);
  if (!host) return;
  host.querySelectorAll('[data-block-end]').forEach((node) => node.addEventListener('click', () => {
    const to = node.dataset.blockEnd;
    renderBreakConfirmationStep(null, { date, workplaceId, from, to, onCreated });
  }));
}

function renderBreakConfirmationStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  modalRoot ||= pushRecordLayer();
  const host = flowHost(modalRoot);
  if (!host) return;
  const workplace = findWorkplaceName(workplaceId);
  const formattedDate = formatConfirmationDate(date);
  const card = entityCard({
    title: 'Перерыв',
    topMeta: [{ value: workplace, row: 1 }],
    topRightMeta: [
      { value: formattedDate, row: 2, weight: 'regular' },
      { value: `${from} - ${to}`, row: 3, weight: 'regular' },
    ],
    className: 'entity-card--hero entity-card--top-dark',
  });
  host.innerHTML = `<div class="record-screen record-screen--state-view">${card}</div>`;
  setRecordPrimaryAction(modalRoot, {
    label: 'Подтвердить',
    onClick: () => {
    const availability = checkTimeAvailability({
      date: dateKey(date),
      workplaceId,
      from,
      to,
    });
    if (!availability.ok) {
      openNotice({
        title: 'Перерыв',
        message: availability.reason === 'occupied' ? 'Это время уже занято.' : 'Это время находится вне рабочего периода.',
      });
      return;
    }
    if (!createJournalBreak({ workplaceId: String(workplaceId || ''), date: dateKey(date), from: String(from), to: String(to) })) return;
    closeRecordLayers();
    onCreated?.();
    },
  });
}

function findWorkplaceName(workplaceId) {
  const workplace = getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(workplaceId ?? ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function formatConfirmationDate(date) {
  const value = date instanceof Date ? dateKey(date) : String(date || '');
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : value;
}

export function openRecordCreation(options = {}) {
  renderTimeStep(null, options);
}