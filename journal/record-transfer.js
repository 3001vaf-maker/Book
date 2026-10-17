import {
  initCalendar,
  initTimePickers,
  mountRecordZ,
  recordWorkplaceCards,
  renderRecordZ,
  timePicker,
  closeRecordZStack,
} from '../ui/ui.js';
import { getProfile } from '../core/profile/data.js';
import { workplaceCardAppearance, workplaceCardFields, workplaceCardPhoto } from '../core/profile/card-presentation.js';
import { checkTimeAvailability, minutesToTime, timeToMinutes } from '../core/time/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../core/workplace-time.js';

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ownerOptions() {
  const profile = getProfile();
  const initials = [profile?.name, profile?.surname]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    aImage: String(profile?.photo || ''),
    aImagePosition: `${Number(profile?.photoCropX ?? 50)}% ${Number(profile?.photoCropY ?? 50)}%`,
    aInitials: initials,
  };
}

export function openRecordTransfer({
  startAt = 'time',
  date,
  workplaceId,
  from,
  to,
  duration = 30,
  excludeId = '',
  onApply = () => {},
} = {}) {
  const draft = {
    date: dateKey(date),
    workplaceId: String(workplaceId || ''),
    from: String(from || ''),
    to: String(to || ''),
  };
  const className = 'record-transfer-z';
  const closeFlow = () => closeRecordZStack(className);
  const apply = () => {
    onApply({ ...draft });
    closeFlow();
  };

  const openTime = () => {
    const layer = mountRecordZ({ ...ownerOptions(), title: 'Выбор времени', showA: false, className });
    const host = renderRecordZ(layer, `<div class="record-screen record-screen--state-view"><div class="compact-form">${timePicker({
      name: 'recordTransferExactTime',
      label: 'Время',
      value: draft.from,
      minuteStep: 1,
    })}</div></div>`);
    if (!host) return;
    initTimePickers(host);
    const input = host.querySelector('input[name="recordTransferExactTime"]');
    input?.addEventListener('change', () => {
      const nextFrom = String(input.value || '');
      const start = timeToMinutes(nextFrom);
      const nextTo = start == null ? '' : minutesToTime(start + Math.max(5, Number(duration) || 30));
      if (!nextFrom || !nextTo) return;
      if (!checkTimeAvailability({
        date: draft.date,
        workplaceId: draft.workplaceId,
        from: nextFrom,
        to: nextTo,
        excludeId,
      }).ok) return;
      draft.from = nextFrom;
      draft.to = nextTo;
      apply();
    });
  };

  const openDate = () => {
    const layer = mountRecordZ({ ...ownerOptions(), title: 'Выбор даты', showA: false, className });
    const host = renderRecordZ(layer, '<div class="record-screen record-screen--state-view"><div data-record-transfer-calendar></div></div>');
    const calendarRoot = host?.querySelector('[data-record-transfer-calendar]');
    const workingDates = getWorkplaceWorkingDates(draft.workplaceId);
    const current = new Date(`${draft.date || workingDates[0] || dateKey(new Date())}T00:00:00`);
    initCalendar(calendarRoot, {
      month: new Date(current.getFullYear(), current.getMonth(), 1),
      selectedValue: draft.date,
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
    const host = renderRecordZ(layer, `<div class="record-screen record-screen--state-view">${recordWorkplaceCards(items, { data: 'data-record-transfer-workplace' })}</div>`);
    host?.querySelectorAll('[data-record-transfer-workplace]').forEach((node) => node.addEventListener('click', () => {
      draft.workplaceId = String(node.dataset.recordTransferWorkplace || '');
      apply();
    }));
  };

  if (startAt === 'workplace') openWorkplace();
  else if (startAt === 'date') openDate();
  else openTime();
  return true;
}
