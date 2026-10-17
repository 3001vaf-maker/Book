import {
  closeRecordZStack,
  initCalendar,
  initTimePickers,
  mountRecordZ,
  openNotice,
  recordWorkplaceCards,
  renderRecordZ,
  timePicker,
} from '../ui/ui.js';
import { getProcedures } from '../core/service/procedures/data.js';
import { checkTimeAvailability, minutesToTime, timeToMinutes } from '../core/time/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../core/workplace-time.js';
import { getProfile } from '../core/profile/data.js';
import { workplaceCardAppearance, workplaceCardFields, workplaceCardPhoto } from '../core/profile/card-presentation.js';

const procedures = () => getProcedures();

function recordOwnerOptions({ chatPersonKey = '', chatPersonKeys = [] } = {}) {
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
  return Boolean(workplaceAssignment(procedure, workplaceId));
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
  const ownerOptions = () => recordOwnerOptions({ chatPersonKey, chatPersonKeys });
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
