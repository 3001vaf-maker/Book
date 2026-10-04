import { button, durationPicker, durationText, entityCard, escapeHtml, field, list, select, timePicker, initTimePickers, v2ListEntry, stateView, initStateView, initCalendar, mountModal, modal, openNotice, initDurationPickers, initMultiSelect, viewNavigation, initViewNavigation, mountRecordZ, recordZHost, renderRecordZ, recordTimeRows, recordWorkplaceCards, recordProcedureList, recordPersonList, recordConfirmationMiniCard, setRecordPrimaryAction, bindRecordSettings, closeRecordZStack } from '../ui/ui.js';
import { createRecord } from '../core/record/index.js';
import { createJournalBreak } from './break-service.js';
import { getPeople } from '../core/people/data.js';
import { personDisplay } from '../core/people/presentation.js';
import { openPersonCreate } from '../core/people/create.js';
import { openPerson } from '../core/people/people.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { openProcedureEditor } from '../settings/service/procedures/procedures.js';
import { assignProceduresToWorkplace } from '../settings/service/procedures/service.js';
import { checkTimeAvailability, listAvailableEndTimes, listAvailableStartTimes } from '../core/time/index.js';
import { timeToMinutes, minutesToTime } from '../core/time/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../core/workplace-time.js';
import { journalRecordActionContext } from './record-action-context.js';
import { getProfile } from '../settings/profile/data.js';
import { calculateSettlement, recordSettlementDiscountPercent } from '../core/finance/index.js';

const RECORD_MODES = [
  { id: 'record', label: 'Создать запись' },
  { id: 'block', label: 'Занять время' },
];

const people = () => getPeople();
const procedures = () => getProcedures();

function recordOwnerOptions({ settings = false, chatPersonKey = '' } = {}) {
  const profile = getProfile();
  const initials = [profile?.name, profile?.surname].filter(Boolean).map((value) => String(value).trim().charAt(0)).join('').slice(0, 2).toUpperCase();
  return {
    settings,
    chatPersonKey,
    aImage: String(profile?.photo || ''),
    aImagePosition: `${Number(profile?.photoCropX ?? 50)}% ${Number(profile?.photoCropY ?? 50)}%`,
    aInitials: initials,
  };
}

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

function openRecordTimeNotice(message) {
  openNotice({ title: 'Недостаточно времени', message });
}

function renderTimeStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  modalRoot ||= mountRecordZ({ ...recordOwnerOptions(), title: 'Выбор времени', showA: false, className: 'record-flow-z' });
  let activeMode = 'record';
  const values = recordStartTimes({ date: dateKey(date), workplaceId, from });
  const toggle = viewNavigation({ views: RECORD_MODES, activeView: activeMode, className: 'segment-control--two', ariaLabel: 'Режим записи' });
  const host = renderRecordZ(modalRoot, `<div class="record-screen record-screen--time">${toggle}${recordTimeRows(values, { data: 'data-record-time', accentEvery: 30 })}</div>`);
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
  const content = recordProcedureList(available.map((procedure) => {
    const cost = defaultCost(procedure, '');
    return {
      id: String(procedure.id || ''),
      name: procedure.name || '',
      durationText: durationText(procedure.duration),
      costText: cost !== '' ? `${cost} ₽` : '',
      aria: `Подключить процедуру ${procedure.name || ''} к рабочему месту`,
    };
  }), {
    data: 'data-record-price-procedure',
    selected: [],
    empty: 'Процедур нет.',
  });
  const m = mountModal(document.body, modal(`<div class="modal-title"><h2>Из прайса</h2><p>Отметьте процедуры, которые выполняются в этом рабочем месте.</p></div><div data-record-price-list>${content}</div><div class="modal-actions">${button('Добавить', { data: 'data-record-price-save' })}</div>`, { variant: 'bottom', surface: 'app', className: 'modal--form-sheet' }));
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

function renderProceduresStep(modalRoot, {
  date,
  workplaceId,
  from,
  to,
  onCreated,
  initialSelected = [],
  onDone = null,
  excludeId = '',
  className = 'record-flow-z',
  allowDurationCorrection = false,
} = {}) {
  modalRoot ||= mountRecordZ({ ...recordOwnerOptions({ settings: true }), title: 'Выбор процедур', className });
  let items = procedures().filter((procedure) => procedureForWorkplace(procedure, workplaceId));
  const selected = new Map();
  (Array.isArray(initialSelected) ? initialSelected : []).forEach((entry) => {
    const source = entry?.procedure || entry || {};
    const id = String(source?.id || entry?.id || '');
    if (!id) return;
    const catalog = procedures().find((item) => String(item?.id || '') === id) || null;
    if (catalog && !procedureForWorkplace(catalog, workplaceId)) return;
    const procedure = catalog || { id, name: source?.name || entry?.name || 'Процедура', duration: Number(entry?.duration ?? source?.duration) || 0 };
    if (!items.some((item) => String(item?.id || '') === id)) items.push(procedure);
    selected.set(id, {
      procedure,
      cost: entry?.cost ?? defaultCost(procedure, workplaceId),
      duration: Number(entry?.duration ?? procedure?.duration) || 0,
    });
  });
  let selectionController = null;
  const host = renderRecordZ(modalRoot, `<div class="record-screen record-screen--procedures"><div data-record-procedures></div></div>`);
  if (!host) return;

  const currentEnd = () => {
    const duration = [...selected.values()].reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    return minutesToTime(timeToMinutes(from) + duration);
  };

  const syncActions = () => {
    const hasSelection = selected.size > 0;
    if (!hasSelection) {
      setRecordPrimaryAction(modalRoot);
      return;
    }
    setRecordPrimaryAction(modalRoot, {
      label: 'Далее',
      onClick: () => {
        const end = currentEnd();
        if (!checkTimeAvailability({ date: dateKey(date), workplaceId, from, to: end, excludeId }).ok) {
          openRecordTimeNotice('Запись не может быть создана: выбранным процедурам не хватает свободного времени. Скорректируйте время записи.');
          return;
        }
        if (typeof onDone === 'function') {
          onDone({ procedures: [...selected.values()], to: end });
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
    listHost.innerHTML = recordProcedureList(items.map((procedure) => {
      const selectedItem = selected.get(String(procedure.id || ''));
      const cost = selectedItem?.cost ?? defaultCost(procedure, workplaceId);
      return {
        id: procedure.id,
        name: procedure.name || '',
        durationText: durationText(selectedItem?.duration ?? procedure.duration),
        costText: cost !== '' ? `${cost} ₽` : '',
      };
    }), {
      data: 'data-procedure-select',
      selected: [...selected.keys()],
      empty: 'Процедур для этого места работы пока нет.',
    });
    syncActions();
    selectionController?.destroy();
    selectionController = initMultiSelect(listHost, {
      selectedValues: [...selected.keys()],
      selector: '[data-procedure-select]',
      valueAttribute: 'procedureSelect',
      onChange: (values) => {
        const next = new Map();
        values.forEach((id) => {
          const procedure = items.find((item) => String(item.id) === String(id));
          if (procedure) next.set(String(id), selected.get(String(id)) || {
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
    const menu = `<div class="modal-actions">
      ${allowDurationCorrection && selected.size ? button('Время процедур', { data: 'data-record-settings-duration', variant: 'secondary' }) : ''}
      ${button('Добавить из прайса', { data: 'data-record-settings-from-price', variant: 'secondary' })}
      ${button('+ Добавить процедуру', { data: 'data-record-settings-add-procedure' })}
    </div>`;
    const m = mountModal(document.body, modal(menu, { variant: 'bottom', surface: 'app' }));
    m?.querySelector('[data-record-settings-duration]')?.addEventListener('click', () => {
      m.v2Close?.();
      const rows = recordProcedureList([...selected.entries()].map(([id, item]) => ({
        id,
        name: item?.procedure?.name || 'Процедура',
        durationText: durationText(item?.duration),
        costText: item?.cost === '' || item?.cost == null ? '' : `${item.cost} ₽`,
      })), {
        data: 'data-record-duration-edit',
        selected: [],
        empty: 'Процедуры не выбраны.',
      });
      const durationLayer = mountModal(document.body, modal(rows, { variant: 'bottom', surface: 'app', className: 'modal--form-sheet' }));
      durationLayer?.querySelectorAll('[data-record-duration-edit]').forEach((node) => node.addEventListener('click', () => {
        const id = String(node.dataset.recordDurationEdit || '');
        const current = selected.get(id);
        if (!current) return;
        durationLayer.v2Close?.();
        openProcedureSettings({
          procedure: current.procedure,
          current,
          onSave: (updated) => {
            selected.set(id, updated);
            render();
          },
        });
      }));
    });
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
      const appRoot = modalRoot?.closest?.('[data-v2-app]') || document.querySelector('[data-v2-app]') || document.body;
      openProcedureEditor(appRoot, null, {
        onSaved: (procedure) => {
          assignProceduresToWorkplace({
            procedureIds: [procedure.id],
            workplaceId,
            workplaceName: getWorkplaces().find((item) => String(item.key || item.id || '') === String(workplaceId || ''))?.name || '',
          });
          items = procedures().filter((item) => procedureForWorkplace(item, workplaceId));
          const assigned = items.find((item) => String(item.id) === String(procedure.id)) || procedure;
          if (procedureForWorkplace(assigned, workplaceId)) {
            selected.set(String(assigned.id), {
              procedure: assigned,
              cost: defaultCost(assigned, workplaceId),
              duration: Number(assigned.duration) || 0,
            });
          }
          render();
        },
      });
    });
  });
  render();
}

function openProcedureSettings({ procedure, current, onSave, onAdd, onDelete }) {
  if (!procedure) return;
  const value = current || { procedure, cost: defaultCost(procedure, ''), duration: Number(procedure.duration) || 0 };
  const addAction = onAdd ? button('+ Добавить процедуру', { data: 'data-record-add-procedure', variant: 'secondary' }) : '';
  const deleteAction = onDelete ? button('Удалить процедуру', { data: 'data-record-delete-procedure', variant: 'danger' }) : '';
  const durationField = durationPicker({ name: 'recordDuration', label: 'Время', value: Number(value.duration) || 0 });
  const html = `<div class="modal-title"><h2>${escapeHtml(procedure.name)}</h2><p>Скорректируйте время процедуры для этой записи.</p></div><div class="compact-form">${durationField}<div class="modal-actions">${button('Сохранить', { data: 'data-record-save' })}${addAction}${deleteAction}</div></div>`;
  const m = mountModal(document.body, modal(html, { variant: 'bottom', surface: 'app', className: 'modal--form-sheet' }));
  if (!m) return;
  initDurationPickers(m);
  m.querySelector('[data-record-add-procedure]')?.addEventListener('click', () => {
    m.remove();
    onAdd?.();
  });
  m.querySelector('[data-record-delete-procedure]')?.addEventListener('click', () => {
    m.remove();
    onDelete?.();
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
  modalRoot ||= mountRecordZ({ ...recordOwnerOptions({ settings: true }), title: 'Выбор клиента', className: 'record-flow-z' });
  let all = people();
  let filtered = all;
  let selectedPerson = null;
  const host = renderRecordZ(modalRoot, `<div class="record-screen record-screen--people"><div class="ui-search-field">${field({ name: 'recordPersonSearch', type: 'search', placeholder: 'Поиск по имени или UEI', autocomplete: 'off', data: 'data-record-person-search' })}</div><div class="ui-search-divider" aria-hidden="true"></div><div class="record-person-list" data-record-person-list></div></div>`);
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
    listHost.innerHTML = recordPersonList(filtered.map((person) => {
      const display = personDisplay(person);
      return {
        key: person.key,
        name: display.name,
        uei: display.uei,
        phone: display.phone,
        aria: `Выбрать человека ${display.name}`,
      };
    }), {
      data: 'data-record-person',
      selected: selectedPerson?.key || '',
      empty: 'Люди не найдены.',
    });

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
    const m = mountModal(document.body, modal(
      `<div class="modal-actions">${button('+ Добавить клиента', { data: 'data-record-settings-add-person' })}</div>`,
      { variant: 'bottom', surface: 'app' },
    ));
    m?.querySelector('[data-record-settings-add-person]')?.addEventListener('click', () => {
      m.v2Close?.();
      openPersonCreate({
        root: document.body,
        variant: 'bottom',
        surface: 'app',
        className: 'modal--form-sheet',
        onCreated: (person) => {
          all = people();
          filtered = all;
          openSelectedPerson(all.find((item) => item.key === person.key) || person);
        },
      });
    });
  });
  render();
}

function renderConfirmationStep(modalRoot, { date, workplaceId, from, to, selectedPerson, selectedProcedures, onCreated }) {
  modalRoot ||= mountRecordZ({
    ...recordOwnerOptions({ settings: true, chatPersonKey: selectedPerson?.key || '' }),
    title: 'Подтверждение записи',
    className: 'record-flow-z',
  });
  let currentDate = dateKey(date);
  let currentWorkplaceId = workplaceId;
  let currentFrom = from;
  let currentTo = to;
  let currentPerson = selectedPerson;

  const duration = () => selectedProcedures.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
  const settlement = () => calculateSettlement(selectedProcedures.map((entry) => ({
    id: entry?.procedure?.id || '',
    name: entry?.procedure?.name || '',
    cost: entry?.cost,
  })), {
    discountPercent: recordSettlementDiscountPercent(currentPerson),
  });
  const totalCost = () => settlement().planTotal;
  const openRecordSettings = () => {
    const layer = mountModal(document.body, modal(
      `<div class="compact-form">${select({
        label: 'Изменить',
        name: 'recordConfirmationEditStep',
        value: '',
        options: [
          { value: '', label: 'Без выбора' },
          { value: 'workplace', label: 'Пространство' },
          { value: 'date', label: 'Дата' },
          { value: 'time', label: 'Время' },
          { value: 'procedure', label: 'Процедура' },
        ],
        aria: 'Выберите этап редактирования записи',
      })}</div>`,
      { variant: 'bottom', surface: 'app', title: 'Настройки записи', className: 'modal--form-sheet' },
    ));
    const input = layer?.querySelector('input[name="recordConfirmationEditStep"]');
    input?.addEventListener('change', () => {
      const startAt = String(input.value || '');
      if (!startAt) return;
      layer.v2Close?.();
      openRecordEditFlow({
        startAt,
        date: currentDate,
        workplaceId: currentWorkplaceId,
        from: currentFrom,
        to: currentTo,
        selectedProcedures,
        onApply: (next) => {
          currentDate = next.date;
          currentWorkplaceId = next.workplaceId;
          currentFrom = next.from;
          currentTo = next.to;
          selectedProcedures.splice(0, selectedProcedures.length, ...next.procedures.map((item) => ({
            procedure: procedures().find((entry) => String(entry?.id || '') === String(item?.id || '')) || {
              id: item.id,
              name: item.name,
              duration: item.duration,
            },
            cost: item.cost,
            duration: item.duration,
          })));
          render();
        },
      });
    });
  };

  bindRecordSettings(modalRoot, openRecordSettings);

  const render = () => {
    const host = recordZHost(modalRoot);
    if (!host) return;
    const person = personDisplay(currentPerson);
    const workplace = findWorkplaceName(currentWorkplaceId);
    const formattedDate = formatConfirmationDate(currentDate);
    const total = totalCost();
    const card = recordConfirmationMiniCard({
      workplace,
      date: formattedDate,
      period: `${currentFrom} - ${currentTo || ''}`,
      uei: person.uei,
      name: person.name,
      phone: person.phone,
      duration: durationText(duration()),
      discount: `${recordSettlementDiscountPercent(currentPerson)}%`,
      total: `${total} ₽`,
      procedures: selectedProcedures.map((item) => ({
        name: item.procedure.name || '',
        durationText: durationText(item.duration),
        right: item.cost === '' || item.cost === null || item.cost === undefined ? '' : `${item.cost} ₽`,
      })),
    });

    host.innerHTML = `<div class="record-screen record-screen--state-view">${card}</div>`;

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
      closeRecordZStack('record-flow-z');
      onCreated?.();
      },
    });
  };

  render();
}

function selectedRecordProcedures(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    procedure: {
      id: item?.procedure?.id || item?.id || '',
      name: item?.procedure?.name || item?.name || '',
      duration: Number(item?.duration ?? item?.procedure?.duration) || 0,
    },
    cost: item?.cost ?? item?.procedure?.cost ?? '',
    duration: Number(item?.duration ?? item?.procedure?.duration) || 0,
  }));
}

export function openRecordEditFlow({
  startAt = 'time',
  date,
  workplaceId,
  from,
  to,
  selectedProcedures = [],
  excludeId = '',
  onApply = () => {},
} = {}) {
  const draft = {
    date: dateKey(date),
    workplaceId: String(workplaceId || ''),
    from: String(from || ''),
    to: String(to || ''),
    procedures: selectedRecordProcedures(selectedProcedures),
  };
  const className = 'record-edit-z';
  const closeFlow = () => closeRecordZStack(className);
  const apply = () => {
    onApply({
      date: draft.date,
      workplaceId: draft.workplaceId,
      from: draft.from,
      to: draft.to,
      procedures: draft.procedures.map((entry) => ({
        id: entry?.procedure?.id || '',
        name: entry?.procedure?.name || '',
        cost: entry?.cost,
        duration: Number(entry?.duration) || 0,
      })),
    });
    closeFlow();
  };

  const openProcedures = () => {
    renderProceduresStep(null, {
      date: draft.date,
      workplaceId: draft.workplaceId,
      from: draft.from,
      to: draft.to,
      initialSelected: draft.procedures,
      excludeId,
      className,
      allowDurationCorrection: true,
      onDone: ({ procedures: next, to: nextTo }) => {
        draft.procedures = next;
        draft.to = nextTo;
        apply();
      },
    });
  };

  const openTime = () => {
    const duration = Math.max(5, draft.procedures.reduce((sum, item) => sum + (Number(item?.duration) || 0), 0));
    const layer = mountRecordZ({ ...recordOwnerOptions(), title: 'Выбор времени', showA: false, className });
    const host = renderRecordZ(layer, `<div class="record-screen record-screen--state-view"><div class="compact-form">${timePicker({
      name: 'recordEditExactTime',
      label: 'Время',
      value: draft.from,
      minuteStep: 1,
    })}</div></div>`);
    if (!host) return;
    initTimePickers(host);
    const input = host.querySelector('input[name="recordEditExactTime"]');
    input?.addEventListener('change', () => {
      const nextFrom = String(input.value || '');
      const start = timeToMinutes(nextFrom);
      const nextTo = start == null ? '' : minutesToTime(start + duration);
      if (!nextFrom || !nextTo) return;
      const availability = checkTimeAvailability({
        date: draft.date,
        workplaceId: draft.workplaceId,
        from: nextFrom,
        to: nextTo,
        excludeId,
      });
      if (!availability.ok) {
        openNotice({
          title: 'Недостаточно времени',
          message: availability.reason === 'occupied'
            ? 'Это время уже занято. Выберите другое время.'
            : 'Это время находится вне рабочего периода. Выберите другое время.',
        });
        return;
      }
      draft.from = nextFrom;
      draft.to = nextTo;
      openProcedures();
    });
  };

  const openDate = () => {
    const layer = mountRecordZ({ ...recordOwnerOptions(), title: 'Выбор даты', showA: false, className });
    const host = renderRecordZ(layer, '<div class="record-screen record-screen--state-view"><div data-record-edit-calendar></div></div>');
    const calendarRoot = host?.querySelector('[data-record-edit-calendar]');
    const workingDates = getWorkplaceWorkingDates(draft.workplaceId);
    const current = new Date(`${draft.date || workingDates[0] || dateKey(new Date())}T00:00:00`);
    initCalendar(calendarRoot, {
      month: new Date(current.getFullYear(), current.getMonth(), 1),
      workingDates,
      onDateSelect: (nextDate) => {
        if (!workingDates.includes(nextDate)) return;
        draft.date = nextDate;
        openTime();
      },
    });
  };

  const openWorkplace = () => {
    const layer = mountRecordZ({ ...recordOwnerOptions(), title: 'Выбор пространства', showA: false, className });
    const items = getWorkplaces().map((workplace) => ({
      ...workplace,
      fields: Array.isArray(workplace.fields) ? workplace.fields : [
        { value: workplace.name || workplace.title || 'Рабочее пространство' },
      ],
    }));
    const host = renderRecordZ(layer, `<div class="record-screen record-screen--state-view">${recordWorkplaceCards(items, { data: 'data-record-edit-workplace' })}</div>`);
    host?.querySelectorAll('[data-record-edit-workplace]').forEach((node) => node.addEventListener('click', () => {
      draft.workplaceId = String(node.dataset.recordEditWorkplace || '');
      draft.procedures = draft.procedures.filter((entry) => {
        const catalog = procedures().find((item) => String(item?.id || '') === String(entry?.procedure?.id || ''));
        return Boolean(catalog && procedureForWorkplace(catalog, draft.workplaceId));
      });
      openDate();
    }));
  };

  if (startAt === 'workplace') openWorkplace();
  else if (startAt === 'date') openDate();
  else if (startAt === 'procedure') openProcedures();
  else openTime();
  return true;
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
  modalRoot ||= mountRecordZ({ ...recordOwnerOptions(), className: 'record-flow-z' });
  const values = blockEndValues({ date, workplaceId, from });
  const host = renderRecordZ(modalRoot, `<div class="record-screen record-screen--time"><div class="record-time-toolbar"><strong>До скольки занять</strong></div>${recordTimeRows(values, {
    data: 'data-block-end',
    empty: 'Свободного времени нет.',
    accentEvery: 30,
  })}</div>`);
  if (!host) return;
  host.querySelectorAll('[data-block-end]').forEach((node) => node.addEventListener('click', () => {
    const to = node.dataset.blockEnd;
    renderBreakConfirmationStep(null, { date, workplaceId, from, to, onCreated });
  }));
}

function renderBreakConfirmationStep(modalRoot, { date, workplaceId, from, to, onCreated }) {
  modalRoot ||= mountRecordZ({ ...recordOwnerOptions(), className: 'record-flow-z' });
  const host = recordZHost(modalRoot);
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
    closeRecordZStack('record-flow-z');
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