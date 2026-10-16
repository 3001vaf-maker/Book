import {
  durationText,
  emptyState,
  initCalendar,
  openNotice,
  openRecordCreationOwner,
  recordConfirmationMiniCard,
  recordCreationTimeRows,
  recordProcedureList,
  recordWorkplaceCards,
} from '../../ui/ui.js';
import { openRecordConfirmationNotice } from '../../ui/record/confirmation-notice.js';
import { calculateSettlement, recordSettlementPricePercent } from '../finance/index.js';
import { getProfile } from '../profile/data.js';
import { workplaceCardAppearance, workplaceCardFields, workplaceCardPhoto } from '../profile/card-presentation.js';
import { createRecord } from '../record/index.js';
import { getProcedures } from '../service/procedures/data.js';
import { procedureCostForWorkplace, procedurePricingForWorkplace, proceduresForWorkplace } from '../service/procedures/selection.js';
import { checkTimeAvailability, getAvailabilityGrid, minutesToTime, timeToMinutes } from '../time/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../workplace-time.js';
import { personDisplay } from './presentation.js';
import { buildPersonRecordTimeRows } from './record-time.js';

function personSnapshot(person = {}) {
  return {
    key: String(person?.key || ''),
    id: String(person?.id || ''),
    name: String(person?.name || ''),
    surname: String(person?.surname || ''),
    phone: String(person?.phone || person?.phones?.[0] || ''),
  };
}

function actionContext() {
  const profile = getProfile();
  return {
    source: 'journal',
    actor: {
      type: 'profile',
      profileId: String(profile?.id || ''),
      accountId: String(profile?.platformAccountId || ''),
    },
  };
}

function workplaceName(workplaceId) {
  const workplace = getWorkplaces().find((item) => String(item?.id ?? item?.key ?? '') === String(workplaceId || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

function workplaceCards() {
  const profile = getProfile();
  return getWorkplaces().map((workplace) => ({
    ...workplace,
    appearance: workplaceCardAppearance(workplace),
    fields: workplaceCardFields(workplace, profile),
    image: workplaceCardPhoto(workplace),
    imagePosition: `${Number(workplace?.photoCropX ?? 50)}% ${Number(workplace?.photoCropY ?? 50)}%`,
  }));
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function totalDuration(selected = []) {
  return (Array.isArray(selected) ? selected : []).reduce((sum, entry) => sum + Math.max(0, Number(entry?.duration) || 0), 0);
}

function timeRows({ date, workplaceId, duration }) {
  const grid = getAvailabilityGrid({ date, workplaceId });
  return buildPersonRecordTimeRows(grid, duration);
}

export function openPersonRecordCreation({ person, onCreated = () => {} } = {}) {
  if (!person?.key) return null;
  const workplaces = getWorkplaces();
  if (!workplaces.length) {
    openNotice({ title: 'Запись недоступна', message: 'Рабочие пространства не настроены.' });
    return null;
  }

  const state = {
    workplaceId: workplaces.length === 1 ? String(workplaces[0]?.id ?? workplaces[0]?.key ?? '') : '',
    procedures: [],
    date: '',
    from: '',
    to: '',
  };
  const owner = openRecordCreationOwner();
  if (!owner) return null;

  const renderConfirmation = () => {
    const display = personDisplay(person);
    const duration = totalDuration(state.procedures);
    const settlement = calculateSettlement(state.procedures.map((entry) => ({
      id: entry.procedure?.id || '',
      name: entry.procedure?.name || '',
      cost: entry.cost,
    })), {
      pricePercent: recordSettlementPricePercent(person),
    });
    const card = recordConfirmationMiniCard({
      workplace: workplaceName(state.workplaceId),
      date: formatDate(state.date),
      period: `${state.from} - ${state.to}`,
      uei: display.uei,
      name: display.name,
      phone: display.phone,
      duration: durationText(duration),
      discount: `${recordSettlementPricePercent(person)}%`,
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
      action: { label: 'Подтвердить', data: 'data-person-record-confirm' },
    });
    view?.action?.addEventListener('click', () => {
      const availability = checkTimeAvailability({
        date: state.date,
        workplaceId: state.workplaceId,
        from: state.from,
        to: state.to,
      });
      if (!availability.ok) {
        openNotice({ title: 'Запись недоступна', message: 'Выбранное время уже занято или недоступно.' });
        return;
      }
      const created = createRecord({
        source: 'journal',
        actionContext: actionContext(),
        date: state.date,
        workplaceId: state.workplaceId,
        from: state.from,
        to: state.to,
        person: personSnapshot(person),
        procedures: state.procedures.map(({ procedure, cost, duration: itemDuration }) => ({
          id: procedure.id,
          name: procedure.name,
          cost,
          duration: itemDuration,
          groupBooking: procedure?.groupBooking ? { ...procedure.groupBooking } : undefined,
        })),
      });
      if (!created) {
        openNotice({ title: 'Запись недоступна', message: 'Не удалось создать запись.' });
        return;
      }
      const noticeProcedures = state.procedures.map((entry) => {
        const pricing = procedurePricingForWorkplace(entry.procedure, state.workplaceId);
        return {
          name: entry.procedure?.name || '',
          value: entry.cost === '' || entry.cost == null ? pricing.value : entry.cost,
          variable: pricing.variable,
          free: pricing.free,
        };
      });
      owner.commit();
      onCreated?.(created);
      openRecordConfirmationNotice({
        date: state.date,
        time: state.from,
        procedures: noticeProcedures,
        total: settlement.planTotal,
        variable: noticeProcedures.some((entry) => entry.variable),
      });
    });
  };

  const renderTimes = () => {
    const duration = totalDuration(state.procedures);
    const rows = timeRows({ date: state.date, workplaceId: state.workplaceId, duration });
    const view = owner.render({
      step: 'time',
      body: rows.length
        ? recordCreationTimeRows(rows, { data: 'data-person-record-time', selected: state.from })
        : emptyState('Свободного времени нет', 'На эту дату нет интервала для выбранных процедур.'),
    });
    view?.body?.querySelectorAll('[data-person-record-time]:not(:disabled)').forEach((node) => node.addEventListener('click', () => {
      const from = String(node.dataset.personRecordTime || '');
      const start = timeToMinutes(from);
      const to = start == null ? '' : minutesToTime(start + duration);
      if (!from || !to) return;
      const availability = checkTimeAvailability({
        date: state.date,
        workplaceId: state.workplaceId,
        from,
        to,
      });
      if (!availability.ok) {
        openNotice({ title: 'Запись недоступна', message: 'Это время уже занято или стало недоступно.' });
        renderTimes();
        return;
      }
      state.from = from;
      state.to = to;
      renderConfirmation();
    }));
  };

  const renderDates = () => {
    const dates = getWorkplaceWorkingDates(state.workplaceId);
    const first = state.date || dates[0] || '';
    const initial = first ? new Date(`${first}T00:00:00`) : new Date();
    const view = owner.render({
      step: 'date',
      body: dates.length
        ? '<div data-person-record-calendar></div>'
        : emptyState('Дат нет', 'Для этого рабочего пространства график не настроен.'),
    });
    const calendarRoot = view?.body?.querySelector('[data-person-record-calendar]');
    if (!calendarRoot) return;
    initCalendar(calendarRoot, {
      month: new Date(initial.getFullYear(), initial.getMonth(), 1),
      selectedValue: state.date || '',
      workingDates: dates,
      onDateSelect: (date) => {
        if (!dates.includes(date)) return;
        state.date = date;
        state.from = '';
        state.to = '';
        renderTimes();
      },
    });
  };

  const renderProcedures = () => {
    const available = proceduresForWorkplace(getProcedures(), state.workplaceId);
    const render = () => {
      const body = recordProcedureList(available.map((procedure) => ({
        id: String(procedure.id || ''),
        name: procedure.name || '',
        durationText: durationText(procedure.duration),
        costText: procedureCostForWorkplace(procedure, state.workplaceId) !== ''
          ? `${procedureCostForWorkplace(procedure, state.workplaceId)} ₽`
          : '',
      })), {
        selected: state.procedures.map((entry) => String(entry.procedure?.id || '')),
        data: 'data-person-record-procedure',
        empty: 'Для этого рабочего пространства процедуры не настроены.',
      });
      const view = owner.render({
        step: 'procedures',
        body,
        action: { label: 'Далее', data: 'data-person-record-procedures-next', disabled: state.procedures.length === 0 },
      });
      view?.body?.querySelectorAll('[data-person-record-procedure]').forEach((node) => node.addEventListener('click', () => {
        const id = String(node.dataset.personRecordProcedure || '');
        const existing = new Map(state.procedures.map((entry) => [String(entry.procedure?.id || ''), entry]));
        if (existing.has(id)) existing.delete(id);
        else {
          const procedure = available.find((item) => String(item.id || '') === id);
          if (procedure) existing.set(id, {
            procedure,
            cost: procedureCostForWorkplace(procedure, state.workplaceId),
            duration: Number(procedure.duration) || 0,
          });
        }
        state.procedures = [...existing.values()];
        state.date = '';
        state.from = '';
        state.to = '';
        render();
      }));
      view?.action?.addEventListener('click', () => {
        if (!state.procedures.length) return;
        renderDates();
      });
    };
    render();
  };

  const renderWorkplaces = () => {
    const items = workplaceCards();
    const view = owner.render({
      step: 'workplace',
      body: items.length
        ? recordWorkplaceCards(items, { data: 'data-person-record-workplace' })
        : emptyState('Нет рабочих пространств', 'Рабочие пространства не настроены.'),
    });
    view?.body?.querySelectorAll('[data-person-record-workplace]').forEach((node) => node.addEventListener('click', () => {
      state.workplaceId = String(node.dataset.personRecordWorkplace || '');
      state.procedures = [];
      state.date = '';
      state.from = '';
      state.to = '';
      renderProcedures();
    }));
  };

  if (state.workplaceId) renderProcedures();
  else renderWorkplaces();
  return owner;
}
