import {
  button,
  closeRecordZStack,
  durationPicker,
  durationText,
  escapeHtml,
  field,
  initCalendar,
  initDurationPickers,
  initMultiSelect,
  initTimePickers,
  initViewNavigation,
  miniCard,
  modal,
  mountModal,
  mountRecordZ,
  openNotice,
  openRecordCreationOwner,
  recordConfirmationMiniCard,
  recordCreationTimeRows,
  recordPersonList,
  recordProcedureList,
  recordWorkplaceCards,
  renderRecordZ,
  timePicker,
  viewNavigation,
} from '../ui/ui.js';
import { createRecord } from '../core/record/index.js';
import { createJournalBreak } from './break-service.js';
import { getPeople } from '../core/people/data.js';
import { personDisplay } from '../core/people/presentation.js';
import { openPersonCreate } from '../core/people/create.js';
import { getProcedures } from '../core/service/procedures/data.js';
import { openProcedureEditor } from '../core/service/procedures/procedures.js';
import { assignProceduresToWorkplace } from '../core/service/procedures/service.js';
import { checkTimeAvailability, getTimeAvailabilityAt, listAvailableEndTimes, minutesToTime, timeToMinutes } from '../core/time/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../core/workplace-time.js';
import { getProfile } from '../core/profile/data.js';
import { workplaceCardAppearance, workplaceCardFields, workplaceCardPhoto } from '../core/profile/card-presentation.js';
import { calculateSettlement, recordSettlementPricePercent } from '../core/finance/index.js';
import { journalRecordActionContext } from './record-action-context.js';

const RECORD_MODES = [
  { id: 'record', label: 'Запись' },
  { id: 'block', label: 'Занять время' },
];

const people = () => getPeople();
const procedures = () => getProcedures();

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    assignmentCost.amount !== '' && assignmentCost.amount != null
    || assignmentCost.from !== '' && assignmentCost.from != null
    || assignmentCost.to !== '' && assignmentCost.to != null
  ) ? assignmentCost : procedureCost;
  if (!cost || cost.free) return '';
  if (typeof cost === 'number' || typeof cost === 'string') return cost;
  return cost.amount ?? cost.from ?? '';
}

function recordPersonSnapshot(person = {}) {
  return {
    key: String(person?.key || ''),
    id: String(person?.id || ''),
    name: String(person?.name || ''),
    surname: String(person?.surname || ''),
    phone: String(person?.phone || person?.phones?.[0] || ''),
  };
}

function groupCapacityForSelectedProcedures(selectedProcedures = []) {
  const items = Array.isArray(selectedProcedures) ? selectedProcedures : [];
  if (!items.length) return 1;
  const capacities = items.map((entry) => {
    const source = entry?.procedure || entry || {};
    const catalog = procedures().find((item) => String(item?.id || '') === String(source?.id || '')) || source;
    if (catalog?.groupBooking?.enabled !== true) return 1;
    return Math.max(2, Math.min(999, Math.floor(Number(catalog?.groupBooking?.capacity) || 2)));
  });
  return capacities.every((value) => value >= 2) ? Math.min(...capacities) : 1;
}

function workplaceName(workplaceId) {
  const workplace = getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(workplaceId || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function hourSlots({ date, workplaceId, hint }) {
  const anchor = timeToMinutes(hint);
  if (anchor == null) return [];
  const hourStart = Math.floor(anchor / 60) * 60;
  const result = [];
  for (let minute = hourStart; minute < Math.min(hourStart + 60, 24 * 60); minute += 5) {
    const value = minutesToTime(minute);
    if (!value) continue;
    const availability = getTimeAvailabilityAt({ date, workplaceId, time: value });
    const free = availability?.state === 'free';
    result.push({
      value,
      label: value,
      available: free,
      occupied: availability?.state === 'occupied',
      state: availability?.state || 'unavailable',
      emphasized: minute % 30 === 0,
    });
  }
  return result;
}

function openPriceProcedurePicker({ workplaceId, onAssigned = () => {} } = {}) {
  const all = procedures();
  if (!all.length) {
    openNotice({ title: 'Прайс', message: 'В прайсе пока нет процедур. Новую процедуру можно создать через «+».' });
    return;
  }

  const available = all.filter((procedure) => !procedureForWorkplace(procedure, workplaceId));
  if (!available.length) {
    openNotice({ title: 'Прайс', message: 'Все процедуры из прайса уже доступны в этом рабочем пространстве.' });
    return;
  }

  const selectedIds = new Set();
  const rows = recordProcedureList(available.map((procedure) => {
    const cost = defaultCost(procedure, '');
    return {
      id: String(procedure.id || ''),
      name: procedure.name || '',
      durationText: durationText(procedure.duration),
      costText: cost !== '' ? `${cost} ₽` : '',
      aria: `Подключить процедуру ${procedure.name || ''} к рабочему пространству`,
    };
  }), {
    data: 'data-record-price-procedure',
    selected: [],
    empty: 'Процедур нет.',
  });

  const layer = mountModal(document.body, modal(
    `<div class="modal-title"><h2>Из прайса</h2><p>Отметьте процедуры для этого рабочего пространства.</p></div>
    <div data-record-price-list>${rows}</div>
    <div class="modal-actions">${button('Добавить', { data: 'data-record-price-save' })}</div>`,
    { variant: 'x', surface: 'app', className: 'modal--form-sheet' },
  ));
  if (!layer) return;

  const listRoot = layer.querySelector('[data-record-price-list]');
  const controller = initMultiSelect(listRoot, {
    selectedValues: [],
    selector: '[data-record-price-procedure]',
    valueAttribute: 'recordPriceProcedure',
    onChange: (values) => {
      selectedIds.clear();
      values.forEach((id) => selectedIds.add(String(id)));
    },
  });

  layer.querySelector('[data-record-price-save]')?.addEventListener('click', () => {
    if (!selectedIds.size) return;
    const workplace = getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(workplaceId || '')) || null;
    const assigned = assignProceduresToWorkplace({
      procedureIds: [...selectedIds],
      workplaceId,
      workplaceName: workplace?.name || workplace?.title || '',
    });
    controller?.destroy?.();
    layer.v2Close?.();
    onAssigned(assigned);
  });
}

function openProcedureSettings({ procedure, current, onSave }) {
  if (!procedure || !current) return;
  const durationField = durationPicker({ name: 'recordDuration', label: 'Время', value: Number(current.duration) || 0 });
  const html = `<div class="modal-title"><h2>${escapeHtml(procedure.name)}</h2><p>Скорректируйте время процедуры для этой записи.</p></div><div class="compact-form">${durationField}<div class="modal-actions">${button('Сохранить', { data: 'data-record-duration-save' })}</div></div>`;
  const layer = mountModal(document.body, modal(html, { variant: 'x', surface: 'app', className: 'modal--form-sheet' }));
  if (!layer) return;
  initDurationPickers(layer);
  layer.querySelector('[data-record-duration-save]')?.addEventListener('click', () => {
    const durationValue = Number(layer.querySelector('[data-duration-value]')?.value);
    onSave?.({
      procedure,
      cost: current.cost,
      duration: Number.isFinite(durationValue) ? durationValue : current.duration,
    });
    layer.v2Close?.();
  });
}

export function openRecordCreation({ date, workplaceId, from, onCreated = () => {} } = {}) {
  const state = {
    date: dateKey(date),
    workplaceId: String(workplaceId || ''),
    hourHint: String(from || ''),
    mode: 'record',
    from: '',
    to: '',
    procedures: [],
    person: null,
    people: [],
  };

  if (!state.date || !state.workplaceId || timeToMinutes(state.hourHint) == null) {
    openNotice({ title: 'Запись недоступна', message: 'Не определены дата, рабочее пространство или время.' });
    return null;
  }
  if (!getWorkplaces().some((item) => String(item?.id ?? item?.key ?? '') === state.workplaceId)) {
    openNotice({ title: 'Запись недоступна', message: 'Рабочее пространство не найдено.' });
    return null;
  }

  const owner = openRecordCreationOwner();
  if (!owner) return null;

  const renderConfirmation = () => {
    const currentPerson = state.people[0] || state.person;
    if (!currentPerson) return;
    const person = personDisplay(currentPerson);
    const capacity = groupCapacityForSelectedProcedures(state.procedures);
    const settlement = calculateSettlement(state.procedures.map((entry) => ({
      id: entry.procedure?.id || '',
      name: entry.procedure?.name || '',
      cost: entry.cost,
    })), {
      pricePercent: recordSettlementPricePercent(currentPerson),
    });
    const totalDuration = state.procedures.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
    const card = recordConfirmationMiniCard({
      workplace: workplaceName(state.workplaceId),
      date: formatDate(state.date),
      period: `${state.from} - ${state.to}`,
      uei: person.uei,
      name: person.name,
      phone: person.phone,
      groupText: capacity > 1 ? `Участники: ${state.people.length} / ${capacity}` : '',
      duration: durationText(totalDuration),
      discount: `${recordSettlementPricePercent(currentPerson)}%`,
      total: `${settlement.planTotal} ₽`,
      procedures: state.procedures.map((entry) => ({
        name: entry.procedure?.name || '',
        durationText: durationText(entry.duration),
        right: entry.cost === '' || entry.cost == null ? '' : `${entry.cost} ₽`,
      })),
    });
    const view = owner.render({
      step: 'confirmation',
      body: `<div class="record-screen record-screen--state-view">${card}</div>`,
      action: { label: 'Подтвердить', data: 'data-record-create-confirm' },
    });
    view?.action?.addEventListener('click', () => {
      if (!checkTimeAvailability({ date: state.date, workplaceId: state.workplaceId, from: state.from, to: state.to }).ok) {
        openNotice({ title: 'Запись недоступна', message: 'Выбранное время уже занято. Закройте запись и выберите другое время.' });
        return;
      }
      const primaryPerson = state.people[0] || state.person;
      const group = capacity > 1 ? {
        capacity,
        participants: state.people.map(recordPersonSnapshot),
      } : null;
      const created = createRecord({
        source: 'journal',
        actionContext: journalRecordActionContext(),
        date: state.date,
        workplaceId: state.workplaceId,
        from: state.from,
        to: state.to,
        person: recordPersonSnapshot(primaryPerson),
        group,
        procedures: state.procedures.map(({ procedure, cost, duration }) => ({
          id: procedure.id,
          name: procedure.name,
          cost,
          duration,
          groupBooking: procedure?.groupBooking ? { ...procedure.groupBooking } : undefined,
        })),
      });
      if (!created) {
        openNotice({ title: 'Запись недоступна', message: 'Не удалось создать запись: выбранное время недоступно.' });
        return;
      }
      owner.commit();
      onCreated?.(created);
    });
  };

  const renderPerson = () => {
    const capacity = groupCapacityForSelectedProcedures(state.procedures);
    const groupMode = capacity > 1;
    let all = people();
    let filtered = all;
    const selected = new Map(state.people.map((person) => [String(person?.key || person?.id || ''), person]));

    const selectPerson = (person) => {
      if (!person) return;
      if (!groupMode) {
        state.person = person;
        state.people = [person];
        renderConfirmation();
        return;
      }
      const key = String(person?.key || person?.id || '');
      if (!key) return;
      if (selected.has(key)) selected.delete(key);
      else if (selected.size < capacity) selected.set(key, person);
      else {
        openNotice({ title: 'Групповая запись', message: `Для выбранных процедур максимум ${capacity} человек.` });
        return;
      }
      state.people = [...selected.values()];
      render();
    };

    const openAddPerson = () => {
      openPersonCreate({
        root: document.body,
        variant: 'x',
        surface: 'app',
        className: 'modal--form-sheet',
        onCreated: (person) => {
          all = people();
          filtered = all;
          const createdPerson = all.find((item) => String(item?.key || item?.id || '') === String(person?.key || person?.id || '')) || person;
          selectPerson(createdPerson);
        },
      });
    };

    const render = () => {
      const selectedKeys = [...selected.keys()].filter(Boolean);
      const listHtml = recordPersonList(filtered.map((person) => {
        const display = personDisplay(person);
        return {
          key: person.key,
          name: display.name,
          uei: display.uei,
          phone: display.phone,
          aria: `Выбрать человека ${display.name}`,
        };
      }), {
        data: 'data-record-create-person',
        selected: selectedKeys,
        empty: 'Люди не найдены.',
      });
      const view = owner.render({
        step: 'person',
        body: `<div class="record-screen record-screen--people">
          ${groupMode ? `<div class="muted">Участники: ${selected.size} / ${capacity}</div>` : ''}
          <div class="ui-search-field">${field({ name: 'recordCreatePersonSearch', type: 'search', placeholder: 'Поиск по имени или UEI', autocomplete: 'off', data: 'data-record-create-person-search' })}</div>
          <div class="ui-search-divider" aria-hidden="true"></div>
          <div class="record-person-list" data-record-create-person-list>${listHtml}</div>
        </div>`,
        footer: button('+ Добавить клиента', { data: 'data-record-create-add-person', variant: 'secondary' }),
        action: groupMode ? { label: 'Далее', data: 'data-record-create-person-next', disabled: selected.size === 0 } : null,
      });
      const body = view?.body;
      if (!body) return;
      body.querySelector('[data-record-create-person-search]')?.addEventListener('input', (event) => {
        const query = event.target.value.trim().toLocaleLowerCase('ru');
        filtered = all.filter((person) => {
          const display = personDisplay(person);
          return display.name.toLocaleLowerCase('ru').includes(query)
            || display.phone.includes(query)
            || display.uei.toLocaleLowerCase('ru').includes(query);
        });
        render();
      });
      body.querySelectorAll('[data-record-create-person]').forEach((node) => node.addEventListener('click', () => {
        const person = all.find((item) => String(item.key) === String(node.dataset.recordCreatePerson)) || null;
        selectPerson(person);
      }));
      view?.footer?.querySelector('[data-record-create-add-person]')?.addEventListener('click', openAddPerson);
      view?.action?.addEventListener('click', () => {
        if (!selected.size) return;
        state.people = [...selected.values()];
        state.person = state.people[0] || null;
        renderConfirmation();
      });
    };

    render();
  };

  const renderProcedures = () => {
    let available = procedures().filter((procedure) => procedureForWorkplace(procedure, state.workplaceId));
    const selected = new Map();
    let controller = null;

    const refreshAvailable = () => {
      available = procedures().filter((procedure) => procedureForWorkplace(procedure, state.workplaceId));
    };

    const openDurationCorrection = () => {
      if (!selected.size) return;
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
      const layer = mountModal(document.body, modal(rows, { variant: 'x', surface: 'app', className: 'modal--form-sheet' }));
      if (!layer) return;
      layer.querySelectorAll('[data-record-duration-edit]').forEach((node) => node.addEventListener('click', () => {
        const id = String(node.dataset.recordDurationEdit || '');
        const current = selected.get(id);
        if (!current) return;
        layer.v2Close?.();
        openProcedureSettings({
          procedure: current.procedure,
          current,
          onSave: (updated) => {
            selected.set(id, updated);
            render();
          },
        });
      }));
    };

    const openFromPrice = () => {
      openPriceProcedurePicker({
        workplaceId: state.workplaceId,
        onAssigned: () => {
          refreshAvailable();
          render();
        },
      });
    };

    const openAddProcedure = () => {
      const appRoot = owner.layer?.closest?.('[data-v2-app]') || document.querySelector('[data-v2-app]') || document.body;
      openProcedureEditor(appRoot, null, {
        onSaved: (procedure) => {
          assignProceduresToWorkplace({
            procedureIds: [procedure.id],
            workplaceId: state.workplaceId,
            workplaceName: workplaceName(state.workplaceId),
          });
          refreshAvailable();
          const assigned = available.find((item) => String(item.id) === String(procedure.id)) || procedure;
          if (procedureForWorkplace(assigned, state.workplaceId)) {
            selected.set(String(assigned.id), {
              procedure: assigned,
              cost: defaultCost(assigned, state.workplaceId),
              duration: Number(assigned.duration) || 0,
            });
          }
          render();
        },
      });
    };

    const render = () => {
      const content = recordProcedureList(available.map((procedure) => ({
        id: procedure.id,
        name: procedure.name || '',
        durationText: durationText(selected.get(String(procedure.id || ''))?.duration ?? procedure.duration),
        costText: selected.get(String(procedure.id || ''))?.cost ?? defaultCost(procedure, state.workplaceId) !== ''
          ? `${selected.get(String(procedure.id || ''))?.cost ?? defaultCost(procedure, state.workplaceId)} ₽`
          : '',
      })), {
        data: 'data-record-create-procedure',
        selected: [...selected.keys()],
        empty: 'Для этого рабочего пространства процедуры не настроены.',
      });
      const view = owner.render({
        step: 'procedures',
        body: `<div class="record-screen record-screen--procedures"><div data-record-create-procedures>${content}</div></div>`,
        footer: `${selected.size ? button('Время процедур', { data: 'data-record-create-duration', variant: 'secondary' }) : ''}${button('Добавить из прайса', { data: 'data-record-create-from-price', variant: 'secondary' })}${button('+ Добавить процедуру', { data: 'data-record-create-add-procedure', variant: 'secondary' })}`,
        action: { label: 'Далее', data: 'data-record-create-procedures-next', disabled: selected.size === 0 },
      });
      const listRoot = view?.body?.querySelector('[data-record-create-procedures]');
      controller?.destroy?.();
      controller = initMultiSelect(listRoot, {
        selectedValues: [...selected.keys()],
        selector: '[data-record-create-procedure]',
        valueAttribute: 'recordCreateProcedure',
        onChange: (values) => {
          const next = new Map();
          values.forEach((id) => {
            const procedure = available.find((item) => String(item.id) === String(id));
            if (!procedure) return;
            next.set(String(id), selected.get(String(id)) || {
              procedure,
              cost: defaultCost(procedure, state.workplaceId),
              duration: Number(procedure.duration) || 0,
            });
          });
          selected.clear();
          next.forEach((value, id) => selected.set(id, value));
          render();
        },
      });
      view?.footer?.querySelector('[data-record-create-duration]')?.addEventListener('click', openDurationCorrection);
      view?.footer?.querySelector('[data-record-create-from-price]')?.addEventListener('click', openFromPrice);
      view?.footer?.querySelector('[data-record-create-add-procedure]')?.addEventListener('click', openAddProcedure);
      view?.action?.addEventListener('click', () => {
        if (!selected.size) return;
        const chosen = [...selected.values()];
        const duration = chosen.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
        const start = timeToMinutes(state.from);
        const to = start == null ? '' : minutesToTime(start + duration);
        if (!to || !checkTimeAvailability({ date: state.date, workplaceId: state.workplaceId, from: state.from, to }).ok) {
          openNotice({ title: 'Недостаточно времени', message: 'Выбранным процедурам не хватает свободного времени. Закройте запись и выберите другое время.' });
          return;
        }
        state.procedures = chosen;
        state.to = to;
        renderPerson();
      });
    };

    render();
  };

  const renderBreakConfirmation = () => {
    const card = miniCard({
      className: 'record-break-mini-card',
      lines: [
        { value: 'Перерыв', strong: true },
        { value: formatDate(state.date), align: 'right' },
        { value: `${state.from} - ${state.to}`, align: 'right' },
      ],
    });
    const view = owner.render({
      step: 'break-confirmation',
      title: 'Подтверждение перерыва',
      body: `<div class="record-screen record-screen--state-view">${card}</div>`,
      action: { label: 'Подтвердить', data: 'data-record-break-confirm' },
    });
    view?.action?.addEventListener('click', () => {
      const availability = checkTimeAvailability({
        date: state.date,
        workplaceId: state.workplaceId,
        from: state.from,
        to: state.to,
      });
      if (!availability.ok) {
        openNotice({
          title: 'Перерыв',
          message: availability.reason === 'occupied' ? 'Это время уже занято.' : 'Это время находится вне рабочего периода.',
        });
        return;
      }
      const created = createJournalBreak({
        workplaceId: state.workplaceId,
        date: state.date,
        from: state.from,
        to: state.to,
      });
      if (!created) return;
      owner.commit();
      onCreated?.(created);
    });
  };

  const renderBlockEnd = () => {
    const values = listAvailableEndTimes({
      date: state.date,
      workplaceId: state.workplaceId,
      from: state.from,
      step: 5,
    });
    const view = owner.render({
      step: 'break-end',
      title: 'Выбор времени до скольки',
      body: `<div class="record-screen record-screen--time">${recordCreationTimeRows(values, {
        data: 'data-record-break-end',
        empty: 'Свободного времени нет.',
      })}</div>`,
    });
    view?.body?.querySelectorAll('[data-record-break-end]:not(:disabled)').forEach((node) => node.addEventListener('click', () => {
      state.to = String(node.dataset.recordBreakEnd || '');
      if (!state.to) return;
      renderBreakConfirmation();
    }));
  };

  const renderTime = () => {
    const slots = hourSlots({ date: state.date, workplaceId: state.workplaceId, hint: state.hourHint });
    const toggle = viewNavigation({
      views: RECORD_MODES,
      activeView: state.mode,
      className: 'segment-control--two',
      ariaLabel: 'Режим времени',
    });
    const view = owner.render({
      step: 'time',
      title: state.mode === 'block' ? 'Выбор времени начала' : 'Выбор времени',
      body: `<div class="record-screen record-screen--time">${toggle}${recordCreationTimeRows(slots, {
        data: 'data-record-create-time',
        empty: 'В этом часу нет рабочего времени.',
      })}</div>`,
    });
    if (!view?.body) return;
    initViewNavigation(view.body, {
      views: RECORD_MODES,
      activeView: state.mode,
      onChange: (nextMode) => {
        if (!RECORD_MODES.some((item) => item.id === nextMode)) return;
        state.mode = nextMode;
        state.from = '';
        state.to = '';
        renderTime();
      },
    });
    view.body.querySelectorAll('[data-record-create-time]:not(:disabled)').forEach((node) => node.addEventListener('click', () => {
      state.from = String(node.dataset.recordCreateTime || '');
      if (!state.from) return;
      if (state.mode === 'block') {
        renderBlockEnd();
        return;
      }
      renderProcedures();
    }));
  };

  renderTime();
  return owner;
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

function recordEditOwnerOptions({ chatPersonKey = '', chatPersonKeys = [] } = {}) {
  const profile = getProfile();
  const initials = [profile?.name, profile?.surname]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    chatPersonKey,
    chatPersonKeys,
    aImage: String(profile?.photo || ''),
    aImagePosition: `${Number(profile?.photoCropX ?? 50)}% ${Number(profile?.photoCropY ?? 50)}%`,
    aInitials: initials,
  };
}

export function openRecordEditFlow({
  startAt = 'time',
  date,
  workplaceId,
  from,
  to,
  selectedProcedures = [],
  excludeId = '',
  chatPersonKey = '',
  chatPersonKeys = [],
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
  const ownerOptions = () => recordEditOwnerOptions({ chatPersonKey, chatPersonKeys });
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
    closeRecordZStack(className);
  };

  const openTime = () => {
    const duration = Math.max(5, draft.procedures.reduce((sum, item) => sum + (Number(item?.duration) || 0), 0));
    const layer = mountRecordZ({ ...ownerOptions(), title: 'Выбор времени', showA: false, className });
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
      apply();
    });
  };

  const openDate = () => {
    const layer = mountRecordZ({ ...ownerOptions(), title: 'Выбор даты', showA: false, className });
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
        apply();
      },
    });
  };

  const openWorkplace = () => {
    const layer = mountRecordZ({ ...ownerOptions(), title: 'Выбор пространства', showA: false, className });
    const profile = getProfile();
    const items = getWorkplaces().map((workplace) => ({
      ...workplace,
      appearance: workplaceCardAppearance(workplace),
      fields: workplaceCardFields(workplace, profile),
      photo: workplaceCardPhoto(workplace),
      imagePosition: `${Number(workplace?.photoCropX ?? 50)}% ${Number(workplace?.photoCropY ?? 50)}%`,
    }));
    const host = renderRecordZ(layer, `<div class="record-screen record-screen--state-view">${recordWorkplaceCards(items, { data: 'data-record-edit-workplace' })}</div>`);
    host?.querySelectorAll('[data-record-edit-workplace]').forEach((node) => node.addEventListener('click', () => {
      draft.workplaceId = String(node.dataset.recordEditWorkplace || '');
      draft.procedures = draft.procedures.filter((entry) => {
        const catalog = procedures().find((item) => String(item?.id || '') === String(entry?.procedure?.id || ''));
        return Boolean(catalog && procedureForWorkplace(catalog, draft.workplaceId));
      });
      apply();
    }));
  };

  if (startAt === 'workplace') openWorkplace();
  else if (startAt === 'date') openDate();
  else openTime();
  return true;
}
