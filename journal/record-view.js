import {
  button,
  durationText,
  entityCard,
  escapeHtml,
  field,
  initCalendar,
  initTimePickers,
  list,
  modal,
  mountModal,
  timePicker,
  timeSlots,
} from '../ui/ui.js';
import { getCompletedPaymentForSource } from '../core/payment.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, getDay, getDayTime } from '../core/day.js';
import { timeToMinutes, minutesToTime } from '../core/time.js';
import { getAllClients } from '../main/clients/data.js';
import { clientDisplay } from '../main/clients/presentation.js';
import { openClientProfile } from '../main/clients/clients.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { getRecords, updateRecord, deleteRecord, checkRecordTime } from './record-data.js';

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
const stateFromRecord = (record, { paid = false } = {}) => ({
  date: record.date,
  workplaceId: record.workplaceId,
  from: record.from,
  to: record.to,
  client: record.client ? { ...record.client } : null,
  procedures: Array.isArray(record.procedures) ? record.procedures.map((item) => ({ ...item })) : [],
  confirmed: Boolean(record.confirmed),
  attendance: paid ? 'arrived' : normalizedAttendance(record.attendance),
});

function workplaceAssignment(procedure, workplaceId) {
  const id = String(workplaceId || '');
  return (procedure?.workplaces || []).find((workplace) => String(workplace?.workplaceId ?? workplace?.id ?? workplace?.key ?? '') === id) || null;
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

function openAddProcedurePicker(state, onSelected) {
  const selectedIds = new Set((state.procedures || []).map((item) => String(item?.id || '')));
  const available = procedures().filter((procedure) => workplaceAssignment(procedure, state.workplaceId) && !selectedIds.has(String(procedure.id || '')));
  const content = list({
    items: available.map((procedure) => ({
      title: procedure.name || '',
      secondary: [durationText(procedure.duration), defaultCost(procedure, state.workplaceId) !== '' ? `${defaultCost(procedure, state.workplaceId)} ₽` : ''],
      interactive: true,
      data: `data-record-view-add-procedure="${escapeHtml(procedure.id || '')}"`,
      aria: `Добавить процедуру ${procedure.name || ''}`,
    })),
  }) || '<div class="muted">Других процедур для этого рабочего места нет.</div>';
  const m = mountModal(document.body, modal(`<div class="modal-title"><h2>Добавить процедуру</h2></div>${content}`, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-view-add-procedure]').forEach((node) => node.addEventListener('click', () => {
    const procedure = available.find((item) => String(item.id) === String(node.dataset.recordViewAddProcedure));
    if (!procedure) return;
    m.remove();
    onSelected?.({
      id: procedure.id,
      name: procedure.name,
      cost: defaultCost(procedure, state.workplaceId),
      duration: Number(procedure.duration) || 0,
    });
  }));
}

function openProcedureCorrection(state, index, { onSave, onAdd, onDelete } = {}) {
  const item = state.procedures?.[index];
  if (!item) return;
  const costField = field({
    label: 'Стоимость',
    name: 'recordCost',
    value: item.cost === '' || item.cost == null ? '' : item.cost,
    inputmode: 'decimal',
    data: 'data-record-view-cost',
  });
  const duration = Math.max(0, Number(item.duration) || 0);
  const durationField = timePicker({
    name: 'recordDuration',
    label: 'Время',
    value: `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`,
    minuteStep: 5,
  });
  const html = `<div class="modal-title"><h2>${escapeHtml(item.name || 'Процедура')}</h2><p>Установите параметры процедуры для этой записи.</p></div><div class="compact-form">${costField}${durationField}<div class="modal-actions">${button('Сохранить', { data: 'data-record-view-procedure-save' })}${button('+ Добавить процедуру', { data: 'data-record-view-procedure-add', variant: 'secondary' })}${button('Удалить процедуру', { data: 'data-record-view-procedure-delete', variant: 'danger' })}</div></div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  initTimePickers(m);
  m.querySelector('[data-record-view-procedure-add]')?.addEventListener('click', () => {
    m.remove();
    onAdd?.();
  });
  m.querySelector('[data-record-view-procedure-delete]')?.addEventListener('click', () => {
    m.remove();
    onDelete?.();
  });
  m.querySelector('[data-record-view-procedure-save]')?.addEventListener('click', () => {
    const rawCost = String(m.querySelector('[data-record-view-cost]')?.value || '').replace(/[^0-9.,-]/g, '').replace(',', '.');
    const timeValue = m.querySelector('[data-time-value]')?.value || '';
    const match = timeValue.match(/^(\d{1,2}):(\d{2})$/);
    onSave?.({
      ...item,
      cost: rawCost === '' ? '' : Number(rawCost),
      duration: match ? Number(match[1]) * 60 + Number(match[2]) : duration,
    });
    m.remove();
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
  const isPaid = () => Boolean(getCompletedPaymentForSource('record', record.id));
  let state = stateFromRecord(record, { paid: isPaid() });
  const original = { ...record };
  let baseline = stateSnapshot(state);
  let startTimer = null;
  const m = mountModal(document.body, modal('<div data-record-view-host></div>', { variant: 'large', surface: 'app' }));
  if (!m) return;
  const root = m.querySelector('[data-record-view-host]');

  const applyPatch = (patch) => {
    if (isPaid()) return;
    const movesAppointment = Object.prototype.hasOwnProperty.call(patch, 'date')
      || Object.prototype.hasOwnProperty.call(patch, 'workplaceId')
      || Object.prototype.hasOwnProperty.call(patch, 'from')
      || Object.prototype.hasOwnProperty.call(patch, 'to');
    state = { ...state, ...patch, ...(movesAppointment ? { attendance: '' } : {}) };
    render();
  };

  const applyProcedures = (nextProcedures) => {
    if (isPaid()) return;
    const start = timeToMinutes(state.from);
    const duration = nextProcedures.length ? procedureTotalDuration(nextProcedures) : 30;
    const nextTo = start == null ? state.to : minutesToTime(start + duration);
    const check = checkRecordTime({
      date: state.date,
      workplaceId: state.workplaceId,
      from: state.from,
      to: nextTo,
      excludeId: original.id,
    });
    if (!check.ok) {
      alert('Новая длительность не помещается в свободный интервал. Выберите другое время.');
      return;
    }
    const patch = { procedures: nextProcedures };
    if (nextTo !== state.to) patch.to = nextTo;
    applyPatch(patch);
  };

  const persistChanges = () => {
    if (isPaid()) return false;
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
    state = stateFromRecord(updated);
    baseline = stateSnapshot(state);
    render();
    return true;
  };

  const scheduleStartRender = () => {
    if (startTimer) clearTimeout(startTimer);
    startTimer = null;
    if (isPaid()) return;
    const start = appointmentStart(state);
    if (!start) return;
    const delay = start.getTime() - Date.now();
    if (delay <= 0) return;
    startTimer = setTimeout(() => render(), Math.min(delay + 50, 2147483647));
  };

  const render = () => {
    scheduleStartRender();
    const paid = isPaid();
    const clientSource = state.client || findClient(record) || {};
    const currentPerson = clientSource?.key
      ? people().find((person) => String(person.key) === String(clientSource.key)) || clientSource
      : clientSource;
    const client = clientDisplay(currentPerson);
    const workplace = workplaceName(state.workplaceId);
    const totalDuration = state.procedures.length ? procedureTotalDuration(state.procedures) : 30;
    const totalCost = procedureTotalCost(state.procedures);
    const detailRows = [
      { left: durationText(totalDuration), right: `${totalCost} ₽`, weight: 'strong' },
      ...state.procedures.map((item, index) => ({
        left: item.name || '',
        right: item.cost === '' || item.cost == null ? '' : `${item.cost} ₽`,
        data: paid ? '' : `data-record-view-procedure-edit="${index}"`,
        aria: paid ? '' : `Изменить процедуру ${item.name || ''}`,
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
        data: paid ? '' : 'data-record-view-workplace-edit',
        aria: paid ? '' : `Изменить рабочее пространство ${workplace}`,
      }],
      topRightMeta: [
        {
          value: formatDate(state.date),
          row: 2,
          data: paid ? '' : 'data-record-view-date-edit',
          aria: paid ? '' : `Изменить дату ${formatDate(state.date)}`,
        },
        {
          value: `${state.from} - ${state.to}`,
          row: 3,
          data: paid ? '' : 'data-record-view-time-edit',
          aria: paid ? '' : `Изменить время ${state.from} - ${state.to}`,
        },
      ],
      detailRows,
      className: 'entity-card--hero entity-card--top-dark',
    });

    const started = hasAppointmentStarted(state);
    const effectiveAttendance = paid ? 'arrived' : (started ? (normalizedAttendance(state.attendance) || 'arrived') : '');
    const statusControl = `<div class="record-status-controls">
      <div class="segment-control segment-control--one" role="group" aria-label="Подтверждение записи">
        <button type="button" class="${state.confirmed ? 'is-active' : ''}" aria-pressed="${state.confirmed}" data-record-view-confirmed${paid ? ' disabled' : ''}>Подтвердил</button>
      </div>
      <div class="segment-control segment-control--two-equal" role="group" aria-label="Посещение записи">
        <button type="button" class="${effectiveAttendance === 'arrived' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'arrived'}" data-record-view-attendance="arrived"${paid || !started ? ' disabled' : ''}>Пришел</button>
        <button type="button" class="${effectiveAttendance === 'no-show' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'no-show'}" data-record-view-attendance="no-show"${paid || !started ? ' disabled' : ''}>Не пришел</button>
      </div>
    </div>`;
    const dirty = stateSnapshot(state) !== baseline;
    const confirmAction = !paid && dirty
      ? `<div class="record-modal-actions modal-actions">${button('Подтвердить изменения', { data: 'data-record-view-confirm' })}</div>`
      : '';
    const cancelAction = paid ? '' : `<div class="record-modal-actions modal-actions">${button('Отменить запись', { data: 'data-record-view-cancel', variant: 'danger' })}</div>`;

    root.innerHTML = `<div class="record-screen record-screen--state-view">${card}${statusControl}${confirmAction}${cancelAction}</div>`;

    root.querySelector('[data-record-view-workplace-edit]')?.addEventListener('click', () => {
      if (isPaid()) return;
      openWorkplacePicker(state, (workplaceId) => applyPatch({ workplaceId }));
    });
    root.querySelector('[data-record-view-date-edit]')?.addEventListener('click', () => {
      if (isPaid()) return;
      openDatePicker(state, (date) => applyPatch({ date }));
    });
    root.querySelector('[data-record-view-time-edit]')?.addEventListener('click', () => {
      if (isPaid()) return;
      openTimePicker(state, original, ({ from, to }) => applyPatch({ from, to }));
    });
    root.querySelectorAll('[data-record-view-client-profile]').forEach((node) => node.addEventListener('click', () => {
      if (!currentPerson?.key) return;
      openClientProfile({ root: document.body, key: currentPerson.key, onClose: render });
    }));
    root.querySelector('[data-record-view-phone]')?.addEventListener('click', () => openPhoneActions(client.phone));
    root.querySelectorAll('[data-record-view-procedure-edit]').forEach((node) => node.addEventListener('click', () => {
      if (isPaid()) return;
      const index = Number(node.dataset.recordViewProcedureEdit);
      if (!Number.isInteger(index) || !state.procedures[index]) return;
      openProcedureCorrection(state, index, {
        onSave: (updated) => {
          const nextProcedures = state.procedures.map((item, itemIndex) => itemIndex === index ? updated : { ...item });
          applyProcedures(nextProcedures);
        },
        onAdd: () => openAddProcedurePicker(state, (added) => {
          applyProcedures([...state.procedures.map((item) => ({ ...item })), added]);
        }),
        onDelete: () => {
          const nextProcedures = state.procedures.filter((_, itemIndex) => itemIndex !== index).map((item) => ({ ...item }));
          applyProcedures(nextProcedures);
        },
      });
    }));
    root.querySelector('[data-record-view-confirmed]')?.addEventListener('click', () => {
      if (isPaid()) return;
      applyPatch({ confirmed: !state.confirmed });
    });
    root.querySelectorAll('[data-record-view-attendance]').forEach((node) => node.addEventListener('click', () => {
      if (isPaid() || !hasAppointmentStarted(state)) return;
      const next = normalizedAttendance(node.dataset.recordViewAttendance);
      const current = normalizedAttendance(state.attendance) || 'arrived';
      if (!next || next === current) return;
      applyPatch({ attendance: next });
    }));
    root.querySelector('[data-record-view-confirm]')?.addEventListener('click', persistChanges);
    root.querySelector('[data-record-view-cancel]')?.addEventListener('click', () => {
      if (isPaid()) return;
      confirmCancel(record, () => {
        m.remove();
        onClose?.();
      });
    });
  };

  const onPaymentsChanged = (event) => {
    const source = event?.detail?.source;
    if (String(source?.type || '') !== 'record' || String(source?.id || '') !== String(record.id)) return;
    const current = getRecords().find((item) => String(item?.id || '') === String(record.id)) || record;
    state = stateFromRecord(current, { paid: true });
    baseline = stateSnapshot(state);
    render();
  };
  window.addEventListener('book:payments-changed', onPaymentsChanged);

  m.addEventListener('click', (event) => {
    if (event.target === m || event.target.closest('[data-modal-close]')) {
      if (startTimer) clearTimeout(startTimer);
      window.removeEventListener('book:payments-changed', onPaymentsChanged);
      queueMicrotask(() => onClose?.());
    }
  });

  render();
}