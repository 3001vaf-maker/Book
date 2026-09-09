import {
  button,
  durationText,
  entityCard,
  escapeHtml,
  initCalendar,
  initMultiSelect,
  list,
  modal,
  mountModal,
  timeSlots,
} from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { timeToMinutes, minutesToTime } from '../core/time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { openClientProfile } from '../main/clients/clients.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { updateRecord, deleteRecord, checkRecordTime } from './record-data.js';

const people = () => getAllClients();
const procedures = () => getProcedures();
const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
};
const workplaceName = (id) => {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(id || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
};
const findClient = (record) => {
  const client = record?.client || {};
  return people().find((item) => String(item.key ?? '') === String(client.key ?? ''))
    || people().find((item) => String(item.id ?? '') === String(client.id ?? ''))
    || client;
};
const procedureTotalCost = (items = []) => items.reduce((sum, item) => {
  const value = Number(item?.cost);
  return Number.isFinite(value) ? sum + value : sum;
}, 0);
const procedureTotalDuration = (items = []) => items.reduce((sum, item) => sum + (Number(item?.duration) || 0), 0);
const normalizedAttendance = (value) => value === 'arrived' || value === 'no-show' ? value : '';
const appointmentStart = (state) => {
  const date = dateKey(state.date);
  const time = String(state.from || '');
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};
const hasAppointmentStarted = (state) => {
  const start = appointmentStart(state);
  return Boolean(start && Date.now() >= start.getTime());
};
const stateSnapshot = (state) => JSON.stringify({
  date: dateKey(state.date),
  workplaceId: String(state.workplaceId || ''),
  from: String(state.from || ''),
  to: String(state.to || ''),
  client: state.client || null,
  procedures: Array.isArray(state.procedures) ? state.procedures : [],
  confirmed: Boolean(state.confirmed),
  attendance: normalizedAttendance(state.attendance),
});

function openWorkplacePicker(state, onSelected) {
  const items = getWorkplaces().map((workplace) => ({
    title: workplace.name || workplace.title || 'Без названия',
    interactive: true,
    selected: String(workplace.key ?? workplace.id ?? '') === String(state.workplaceId || ''),
    data: `data-record-view-workplace="${escapeHtml(workplace.key ?? workplace.id ?? '')}"`,
    aria: `Выбрать рабочее пространство ${workplace.name || workplace.title || ''}`,
  }));
  const content = `<div class="modal-title"><h2>Рабочее пространство</h2></div>${list({ items }) || '<div class="muted">Рабочие пространства не найдены.</div>'}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-view-workplace]').forEach((node) => node.addEventListener('click', () => {
    const id = node.dataset.recordViewWorkplace;
    if (!id) return;
    m.remove();
    onSelected?.(id);
  }));
}

function openDatePicker(state, onSelected) {
  const workingDates = getDays()
    .filter((day) => String(day?.workplaceId || '') === String(state.workplaceId || ''))
    .map((day) => day.date)
    .filter(Boolean);
  const content = `<div class="modal-title"><h2>Выбор даты</h2></div><div data-record-view-calendar></div>`;
  const m = mountModal(document.body, modal(content, { variant: 'large', surface: 'app' }));
  if (!m) return;
  initCalendar(m.querySelector('[data-record-view-calendar]'), {
    month: new Date(`${state.date}T12:00:00`),
    workingDates,
    onDateSelect: (value) => {
      if (!workingDates.includes(value)) return;
      m.remove();
      onSelected?.(value);
    },
  });
}

function availableTimes(state, original) {
  const day = getDay(getDays(), state.workplaceId, state.date);
  const dayTime = getDayTime(day, getWorkplaces());
  if (!dayTime) return [];
  const from = timeToMinutes(state.from);
  const to = timeToMinutes(state.to);
  const duration = from != null && to != null && to > from ? to - from : Math.max(1, procedureTotalDuration(state.procedures));
  const start = timeToMinutes(dayTime.from);
  const end = timeToMinutes(dayTime.to);
  if (start == null || end == null) return [];
  const values = [];
  for (let minutes = Math.ceil(start / 15) * 15; minutes + duration <= end; minutes += 15) {
    const nextFrom = minutesToTime(minutes);
    const nextTo = minutesToTime(minutes + duration);
    if (checkRecordTime({ date: state.date, workplaceId: state.workplaceId, from: nextFrom, to: nextTo, excludeId: original.id }).ok) {
      values.push(nextFrom);
    }
  }
  return values;
}

function openTimePicker(state, original, onSelected) {
  const values = availableTimes(state, original);
  const content = `<div class="modal-title"><h2>Выбор времени</h2></div>${values.length
    ? timeSlots({ values, selected: state.from, data: 'data-record-view-time', ariaLabel: 'Выбрать время записи' })
    : '<div class="muted">Свободного времени нет.</div>'}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-view-time]').forEach((node) => node.addEventListener('click', () => {
    const nextFrom = node.dataset.recordViewTime;
    if (!nextFrom) return;
    const currentFrom = timeToMinutes(state.from);
    const currentTo = timeToMinutes(state.to);
    const duration = currentFrom != null && currentTo != null && currentTo > currentFrom
      ? currentTo - currentFrom
      : Math.max(1, procedureTotalDuration(state.procedures));
    m.remove();
    onSelected?.({ from: nextFrom, to: minutesToTime(timeToMinutes(nextFrom) + duration) });
  }));
}

function openProceduresPicker(state, onSelected) {
  const all = procedures();
  const selected = new Map((state.procedures || []).map((item) => [String(item?.id || ''), { ...item }]).filter(([id]) => id));
  const content = `<div class="modal-title"><h2>Процедуры</h2></div><div data-record-view-procedures></div><div class="modal-actions">${button('Сохранить', { data: 'data-record-view-procedures-save' })}</div>`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  const host = m.querySelector('[data-record-view-procedures]');
  host.innerHTML = list({
    items: all.map((procedure) => ({
      title: procedure.name || '',
      secondary: durationText(procedure.duration),
      interactive: true,
      selected: selected.has(String(procedure.id || '')),
      data: `data-record-view-procedure="${escapeHtml(procedure.id || '')}"`,
      aria: `Выбрать процедуру ${procedure.name || ''}`,
    })),
  }) || '<div class="muted">Процедур пока нет.</div>';
  initMultiSelect(host, {
    selectedValues: [...selected.keys()],
    selector: '[data-record-view-procedure]',
    valueAttribute: 'recordViewProcedure',
    onChange: (values) => {
      const next = new Map();
      values.forEach((id) => {
        const procedure = all.find((item) => String(item.id) === String(id));
        if (!procedure) return;
        const current = selected.get(String(id));
        next.set(String(id), current || {
          id: procedure.id,
          name: procedure.name,
          cost: '',
          duration: Number(procedure.duration) || 0,
        });
      });
      selected.clear();
      next.forEach((value, id) => selected.set(id, value));
    },
  });
  m.querySelector('[data-record-view-procedures-save]')?.addEventListener('click', () => {
    m.remove();
    onSelected?.([...selected.values()]);
  });
}

function openPhoneActions(phone) {
  const value = String(phone || '').trim();
  if (!value) return;
  const content = list({
    items: [
      { title: 'Позвонить', interactive: true, data: 'data-record-view-phone-call', aria: `Позвонить ${value}` },
      { title: 'Написать', interactive: true, data: 'data-record-view-phone-write', aria: `Написать ${value}` },
    ],
  });
  const m = mountModal(document.body, modal(content, { variant: 'compact' }));
  if (!m) return;
  m.querySelector('[data-record-view-phone-call]')?.addEventListener('click', () => {
    window.location.href = `tel:${value.replace(/[^\d+]/g, '')}`;
  });
  m.querySelector('[data-record-view-phone-write]')?.addEventListener('click', () => {
    m.remove();
    mountModal(document.body, modal('<div class="muted">Чат в разработке</div>', { variant: 'compact' }));
  });
}

function confirmCancel(record, onCancelled) {
  const content = `<div class="modal-title"><h2>Отменить запись?</h2><p>Запись будет удалена полностью и освободит это время.</p></div><div class="modal-actions">${button('Нет', { data: 'data-record-cancel-no', variant: 'secondary' })}${button('Отменить запись', { data: 'data-record-cancel-yes', variant: 'danger' })}</div>`;
  const m = mountModal(document.body, modal(content, { variant: 'compact', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-record-cancel-no]')?.addEventListener('click', () => m.remove());
  m.querySelector('[data-record-cancel-yes]')?.addEventListener('click', () => {
    if (!deleteRecord(record.id)) return;
    m.remove();
    onCancelled?.();
  });
}

export function openRecordView(record, { onClose = () => {} } = {}) {
  if (!record?.id) return;
  let state = {
    date: record.date,
    workplaceId: record.workplaceId,
    from: record.from,
    to: record.to,
    client: record.client ? { ...record.client } : null,
    procedures: Array.isArray(record.procedures) ? record.procedures.map((item) => ({ ...item })) : [],
    confirmed: Boolean(record.confirmed),
    attendance: normalizedAttendance(record.attendance),
  };
  const original = { ...record };
  let baseline = stateSnapshot(state);
  let startTimer = null;
  const m = mountModal(document.body, modal('<div data-record-view-host></div>', { variant: 'large', surface: 'app' }));
  if (!m) return;
  const root = m.querySelector('[data-record-view-host]');

  const applyPatch = (patch) => {
    const movesAppointment = Object.prototype.hasOwnProperty.call(patch, 'date')
      || Object.prototype.hasOwnProperty.call(patch, 'workplaceId')
      || Object.prototype.hasOwnProperty.call(patch, 'from')
      || Object.prototype.hasOwnProperty.call(patch, 'to');
    state = { ...state, ...patch, ...(movesAppointment ? { attendance: '' } : {}) };
    render();
  };

  const persistChanges = () => {
    const updated = updateRecord(record.id, {
      date: dateKey(state.date),
      workplaceId: String(state.workplaceId || ''),
      from: state.from,
      to: state.to,
      client: state.client,
      procedures: state.procedures,
      confirmed: Boolean(state.confirmed),
      attendance: normalizedAttendance(state.attendance),
    });
    if (!updated) {
      alert('Не удалось сохранить изменения: проверьте рабочий день и свободное время.');
      return false;
    }
    state = {
      date: updated.date,
      workplaceId: updated.workplaceId,
      from: updated.from,
      to: updated.to,
      client: updated.client ? { ...updated.client } : null,
      procedures: Array.isArray(updated.procedures) ? updated.procedures.map((item) => ({ ...item })) : [],
      confirmed: Boolean(updated.confirmed),
      attendance: normalizedAttendance(updated.attendance),
    };
    baseline = stateSnapshot(state);
    render();
    return true;
  };

  const scheduleStartRender = () => {
    if (startTimer) clearTimeout(startTimer);
    startTimer = null;
    const start = appointmentStart(state);
    if (!start) return;
    const delay = start.getTime() - Date.now();
    if (delay <= 0) return;
    startTimer = setTimeout(() => render(), Math.min(delay + 50, 2147483647));
  };

  const render = () => {
    scheduleStartRender();
    const clientSource = state.client || findClient(record) || {};
    const currentPerson = clientSource?.key
      ? people().find((person) => String(person.key) === String(clientSource.key)) || clientSource
      : clientSource;
    const client = clientDisplay(currentPerson);
    const workplace = workplaceName(state.workplaceId);
    const totalDuration = procedureTotalDuration(state.procedures);
    const totalCost = procedureTotalCost(state.procedures);
    const detailRows = [
      { left: durationText(totalDuration), right: `${totalCost} ₽`, weight: 'strong' },
      ...state.procedures.map((item) => ({
        left: item.name || '',
        right: item.cost === '' || item.cost == null ? '' : `${item.cost} ₽`,
        data: 'data-record-view-procedures-edit',
        aria: 'Изменить процедуры записи',
      })),
    ];
    const card = entityCard({
      id: client.uei,
      title: client.name,
      subtitle: client.phone,
      idData: client.uei && currentPerson?.key ? 'data-record-view-client-profile' : '',
      idAria: client.uei ? `Открыть профиль клиента ${client.name}` : '',
      titleData: currentPerson?.key ? 'data-record-view-client-profile' : '',
      titleAria: `Открыть профиль клиента ${client.name}`,
      subtitleData: client.phone ? 'data-record-view-phone' : '',
      subtitleAria: client.phone ? `Действия с телефоном ${client.phone}` : '',
      topMeta: [{
        value: workplace,
        row: 1,
        data: 'data-record-view-workplace-edit',
        aria: `Изменить рабочее пространство ${workplace}`,
      }],
      topRightMeta: [
        {
          value: formatDate(state.date),
          row: 2,
          data: 'data-record-view-date-edit',
          aria: `Изменить дату ${formatDate(state.date)}`,
        },
        {
          value: `${state.from} - ${state.to}`,
          row: 3,
          data: 'data-record-view-time-edit',
          aria: `Изменить время ${state.from} - ${state.to}`,
        },
      ],
      detailRows,
      className: 'entity-card--hero entity-card--top-dark',
    });

    const started = hasAppointmentStarted(state);
    const effectiveAttendance = started ? (normalizedAttendance(state.attendance) || 'arrived') : '';
    const statusControl = `<div class="segment-control" role="group" aria-label="Статус записи">
      <button type="button" class="${state.confirmed ? 'is-active' : ''}" aria-pressed="${state.confirmed}" data-record-view-confirmed>Подтвердил</button>
      <button type="button" class="${effectiveAttendance === 'arrived' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'arrived'}" data-record-view-attendance="arrived"${started ? '' : ' disabled'}>Пришел</button>
      <button type="button" class="${effectiveAttendance === 'no-show' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'no-show'}" data-record-view-attendance="no-show"${started ? '' : ' disabled'}>Не пришел</button>
    </div>`;
    const dirty = stateSnapshot(state) !== baseline;
    const confirmAction = dirty
      ? `<div class="record-modal-actions modal-actions">${button('Подтвердить изменения', { data: 'data-record-view-confirm' })}</div>`
      : '';
    const cancelAction = `<div class="record-modal-actions modal-actions">${button('Отменить запись', { data: 'data-record-view-cancel', variant: 'danger' })}</div>`;

    root.innerHTML = `<div class="record-screen record-screen--state-view">${card}${statusControl}${confirmAction}${cancelAction}</div>`;

    root.querySelector('[data-record-view-workplace-edit]')?.addEventListener('click', () => {
      openWorkplacePicker(state, (workplaceId) => applyPatch({ workplaceId }));
    });
    root.querySelector('[data-record-view-date-edit]')?.addEventListener('click', () => {
      openDatePicker(state, (date) => applyPatch({ date }));
    });
    root.querySelector('[data-record-view-time-edit]')?.addEventListener('click', () => {
      openTimePicker(state, original, ({ from, to }) => applyPatch({ from, to }));
    });
    root.querySelectorAll('[data-record-view-client-profile]').forEach((node) => node.addEventListener('click', () => {
      if (!currentPerson?.key) return;
      openClientProfile({ root: document.body, key: currentPerson.key, onClose: render });
    }));
    root.querySelector('[data-record-view-phone]')?.addEventListener('click', () => openPhoneActions(client.phone));
    root.querySelectorAll('[data-record-view-procedures-edit]').forEach((node) => node.addEventListener('click', () => {
      openProceduresPicker(state, (nextProcedures) => {
        const start = timeToMinutes(state.from);
        const duration = procedureTotalDuration(nextProcedures);
        const to = start == null ? state.to : minutesToTime(start + duration);
        applyPatch({ procedures: nextProcedures, to });
      });
    }));
    root.querySelector('[data-record-view-confirmed]')?.addEventListener('click', () => {
      if (!state.confirmed) applyPatch({ confirmed: true });
    });
    root.querySelectorAll('[data-record-view-attendance]').forEach((node) => node.addEventListener('click', () => {
      if (!hasAppointmentStarted(state)) return;
      const next = normalizedAttendance(node.dataset.recordViewAttendance);
      const current = normalizedAttendance(state.attendance) || 'arrived';
      if (!next || next === current) return;
      applyPatch({ attendance: next });
    }));
    root.querySelector('[data-record-view-confirm]')?.addEventListener('click', persistChanges);
    root.querySelector('[data-record-view-cancel]')?.addEventListener('click', () => {
      confirmCancel(record, () => {
        m.remove();
        onClose?.();
      });
    });
  };

  m.addEventListener('click', (event) => {
    if (event.target === m || event.target.closest('[data-modal-close]')) {
      if (startTimer) clearTimeout(startTimer);
      queueMicrotask(() => onClose?.());
    }
  });

  render();
}
