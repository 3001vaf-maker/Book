import {
  durationText,
  field,
  initMultiSelect,
  initViewNavigation,
  miniCard,
  openNotice,
  openRecordCreationOwner,
  recordConfirmationMiniCard,
  recordCreationTimeRows,
  recordPersonList,
  recordProcedureList,
  viewNavigation,
} from '../ui/ui.js';
import { createRecord } from '../core/record/index.js';
import { createJournalBreak } from './break-service.js';
import { getPeople } from '../core/people/data.js';
import { personDisplay } from '../core/people/presentation.js';
import { getProcedures } from '../core/service/procedures/data.js';
import { checkTimeAvailability, getTimeAvailabilityAt, listAvailableEndTimes, minutesToTime, timeToMinutes } from '../core/time/index.js';
import { getWorkplaces } from '../core/workplace-time.js';
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
    const state = getTimeAvailabilityAt({ date, workplaceId, time: value });
    const free = state?.state === 'free';
    result.push({
      value,
      label: value,
      available: free,
      occupied: state?.state === 'occupied',
      state: state?.state || 'unavailable',
      emphasized: minute % 30 === 0,
    });
  }
  return result;
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
    const all = people();
    let filtered = all;
    const selected = new Map(state.people.map((person) => [String(person?.key || person?.id || ''), person]));

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
        if (!person) return;
        if (!groupMode) {
          state.person = person;
          state.people = [person];
          renderConfirmation();
          return;
        }
        const key = String(person.key || person.id || '');
        if (selected.has(key)) selected.delete(key);
        else if (selected.size < capacity) selected.set(key, person);
        else {
          openNotice({ title: 'Групповая запись', message: `Для выбранных процедур максимум ${capacity} человек.` });
          return;
        }
        state.people = [...selected.values()];
        render();
      }));
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
    const available = procedures().filter((procedure) => procedureForWorkplace(procedure, state.workplaceId));
    const selected = new Map();
    let controller = null;

    const render = () => {
      const content = recordProcedureList(available.map((procedure) => ({
        id: procedure.id,
        name: procedure.name || '',
        durationText: durationText(procedure.duration),
        costText: defaultCost(procedure, state.workplaceId) !== '' ? `${defaultCost(procedure, state.workplaceId)} ₽` : '',
      })), {
        data: 'data-record-create-procedure',
        selected: [...selected.keys()],
        empty: 'Для этого рабочего пространства процедуры не настроены.',
      });
      const view = owner.render({
        step: 'procedures',
        body: `<div class="record-screen record-screen--procedures"><div data-record-create-procedures>${content}</div></div>`,
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
            next.set(String(id), {
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
