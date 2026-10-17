import {
  button,
  durationText,
  select,
  openSharedProfileSettingsMenu,
  modal,
  mountModal,
  openNotice,
  mountRecordZ,
  recordZHost,
  recordConfirmationMiniCard,
  setRecordPrimaryAction,
  bindRecordSettings,
} from '../ui/ui.js';
import { setV2ZHeaderRows } from '../ui/v2/z-layout.js';
import { getRecordPaymentState, recordSettlementItems, repriceSettlement, refreshFinanceState } from '../core/finance/index.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getAllPeople } from '../core/people/data.js';
import { personDisplay } from '../core/people/presentation.js';
import { getRecords } from '../core/record/index.js';
import { updateRecord, cancelRecord, deleteRecord, refreshRecordsFromServer } from '../core/record/index.js';
import { journalRecordActionContext } from './record-action-context.js';
import { getProfile } from '../core/profile/data.js';
import { openRecordPayment } from './record-payment.js';
import { openRecordEditFlow } from './record.js';
import { openRecordProcedureCorrection } from './record-procedure-correction.js';
import { flushBusinessPersistence } from '../core/business-persistence.js';

function recordOwnerOptions({ settings = false, chatPersonKey = '', chatPersonKeys = [] } = {}) {
  const profile = getProfile();
  const initials = [profile?.name, profile?.surname].filter(Boolean).map((value) => String(value).trim().charAt(0)).join('').slice(0, 2).toUpperCase();
  return {
    settings,
    chatPersonKey,
    chatPersonKeys,
    aImage: String(profile?.photo || ''),
    aImagePosition: `${Number(profile?.photoCropX ?? 50)}% ${Number(profile?.photoCropY ?? 50)}%`,
    aInitials: initials,
  };
}

const people = () => getAllPeople();
const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
};
const formatMoney = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) || 0)} ₽`;
const formatPercent = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) || 0);
const workplaceName = (id) => {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(id || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
};
const findPerson = (record) => {
  const person = record?.person || {};
  return people().find((item) => String(item.key ?? '') === String(person.key ?? ''))
    || people().find((item) => String(item.id ?? '') === String(person.id ?? ''))
    || person;
};
const chatKeysForState = (state = {}) => {
  const participants = Array.isArray(state?.group?.participants) ? state.group.participants : [];
  const keys = participants.map((person) => String(person?.key || person?.id || '')).filter(Boolean);
  const primary = String(state?.person?.key || state?.person?.id || '');
  if (primary && !keys.includes(primary)) keys.unshift(primary);
  return [...new Set(keys)];
};
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
  person: state.person || null,
  group: state.group || null,
  procedures: Array.isArray(state.procedures) ? state.procedures : [],
  products: Array.isArray(state.products) ? state.products : [],
  confirmed: Boolean(state.confirmed),
  attendance: normalizedAttendance(state.attendance),
});
const stateFromRecord = (record, { paid = false } = {}) => ({
  date: record.date,
  workplaceId: record.workplaceId,
  from: record.from,
  to: record.to,
  person: record.person ? { ...record.person } : null,
  group: record.group && typeof record.group === 'object' ? {
    capacity: Math.max(2, Math.floor(Number(record.group.capacity) || 2)),
    participants: Array.isArray(record.group.participants) ? record.group.participants.map((person) => ({ ...person })) : [],
  } : null,
  procedures: Array.isArray(record.procedures) ? record.procedures.map((item) => ({ ...item })) : [],
  products: Array.isArray(record.products) ? record.products.map((item) => ({ ...item })) : [],
  finance: record.finance ? {
    ...record.finance,
    items: Array.isArray(record.finance.items) ? record.finance.items.map((item) => ({ ...item })) : [],
  } : null,
  confirmed: Boolean(record.confirmed),
  attendance: normalizedAttendance(record.attendance) || (paid ? 'arrived' : ''),
});

function workplaceAssignment(item, workplaceId) {
  const id = String(workplaceId || '');
  return (item?.workplaces || []).find((workplace) => String(workplace?.workplaceId ?? workplace?.id ?? workplace?.key ?? '') === id) || null;
}

function defaultCost(item, workplaceId) {
  const assignment = workplaceAssignment(item, workplaceId);
  const assignmentCost = assignment?.cost;
  const itemCost = item?.cost;
  const cost = assignmentCost && typeof assignmentCost === 'object' && !assignmentCost.free && (
    assignmentCost.amount !== '' && assignmentCost.amount != null
    || assignmentCost.from !== '' && assignmentCost.from != null
    || assignmentCost.to !== '' && assignmentCost.to != null
  ) ? assignmentCost : itemCost;
  if (!cost || cost.free) return '';
  if (typeof cost === 'number' || typeof cost === 'string') return cost;
  return cost.amount ?? cost.from ?? '';
}

function confirmCancel(record, onCancelled) {
  const content = `<div class="modal-title"><h2>Отменить запись?</h2><p>Запись останется в истории как отменённая и освободит это время.</p></div><div class="modal-actions">${button('Нет', { data: 'data-record-cancel-no', variant: 'secondary' })}${button('Отменить запись', { data: 'data-record-cancel-yes', variant: 'danger' })}</div>`;
  const m = mountModal(document.body, modal(content, { variant: 'x', surface: 'app', className: 'modal--form-sheet' }));
  if (!m) return;
  m.querySelector('[data-record-cancel-no]')?.addEventListener('click', () => m.v2Close?.());
  m.querySelector('[data-record-cancel-yes]')?.addEventListener('click', async (event) => {
    const submit = event.currentTarget;
    if (submit) submit.disabled = true;
    if (!cancelRecord(record.id, { actionContext: journalRecordActionContext() })) {
      if (submit) submit.disabled = false;
      return;
    }
    try {
      await flushBusinessPersistence();
      await refreshRecordsFromServer();
      m.v2Close?.();
      onCancelled?.();
    } catch (error) {
      await refreshRecordsFromServer().catch(() => null);
      openNotice({ title: 'Не удалось отменить', message: String(error?.message || 'Сервер не подтвердил отмену записи.') });
      if (submit?.isConnected) submit.disabled = false;
    }
  });
}

export function openRecordView(record, { onClose = () => {} } = {}) {
  if (!record?.id) return;
  const recordPaid = (value) => Boolean(getRecordPaymentState(value).fullyPaid);
  let state = stateFromRecord(record, { paid: recordPaid(record) });
  const isPaid = () => recordPaid({ ...record, ...state, id: record.id });
  const original = { ...record };
  let baseline = stateSnapshot(state);
  let startTimer = null;
  let updatingFromView = false;
  let saving = false;
  let finishClose = () => {};
  const initialChatKeys = chatKeysForState(state);
  const m = mountRecordZ({
    ...recordOwnerOptions({
      settings: true,
      chatPersonKey: state.person?.key || state.person?.id || '',
      chatPersonKeys: initialChatKeys,
    }),
    title: personDisplay(findPerson(record) || state.person || {}).name || 'Запись',
    className: 'record-view-z',
    onClose: () => finishClose(),
  });
  if (!m) return;
  const root = recordZHost(m);

  const applyPatch = (patch) => {
    const movesAppointment = Object.prototype.hasOwnProperty.call(patch, 'date')
      || Object.prototype.hasOwnProperty.call(patch, 'workplaceId')
      || Object.prototype.hasOwnProperty.call(patch, 'from')
      || Object.prototype.hasOwnProperty.call(patch, 'to');
    state = { ...state, ...patch, ...(movesAppointment ? { attendance: '' } : {}) };
    render();
  };

  const persistChanges = async () => {
    if (saving) return false;
    saving = true;
    updatingFromView = true;
    const updated = updateRecord(record.id, {
      date: dateKey(state.date),
      workplaceId: String(state.workplaceId || ''),
      from: state.from,
      to: state.to,
      person: state.person,
      group: state.group,
      procedures: state.procedures,
      products: state.products,
      confirmed: Boolean(state.confirmed),
      attendance: normalizedAttendance(state.attendance),
    }, { actionContext: journalRecordActionContext() });
    if (!updated) {
      updatingFromView = false;
      saving = false;
      openNotice({ title: 'Не удалось сохранить', message: 'Проверьте рабочий день и свободное время.' });
      return false;
    }

    try {
      await flushBusinessPersistence();
      await Promise.all([
        refreshRecordsFromServer(),
        refreshFinanceState(),
      ]);
      const current = getRecords().find((item) => String(item?.id || '') === String(record.id)) || updated;
      state = stateFromRecord(current, { paid: recordPaid(current) });
      baseline = stateSnapshot(state);
      return true;
    } catch {
      await refreshRecordsFromServer().catch(() => null);
      await refreshFinanceState().catch(() => null);
      const current = getRecords().find((item) => String(item?.id || '') === String(record.id));
      if (current) {
        state = stateFromRecord(current, { paid: recordPaid(current) });
        baseline = stateSnapshot(state);
      }
      return false;
    } finally {
      updatingFromView = false;
      saving = false;
      if (m.isConnected) render();
    }
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

  const openRecordEdit = (startAt) => {
    const paid = isPaid();
    openRecordEditFlow({
      startAt,
      date: state.date,
      workplaceId: state.workplaceId,
      from: state.from,
      to: state.to,
      selectedProcedures: state.procedures,
      excludeId: record.id,
      chatPersonKey: state.person?.key || state.person?.id || '',
      chatPersonKeys: chatKeysForState(state),
      onApply: (next) => {
        state = {
          ...state,
          date: next.date,
          workplaceId: next.workplaceId,
          from: next.from,
          to: next.to,
          ...(paid ? {} : { procedures: next.procedures }),
          attendance: '',
        };
        render();
      },
    });
  };

  const openProcedureCorrection = (procedureIndex) => {
    if (isPaid()) return;
    openRecordProcedureCorrection({
      date: dateKey(state.date),
      workplaceId: state.workplaceId,
      from: state.from,
      selectedProcedures: state.procedures,
      procedureIndex,
      excludeId: record.id,
      onApply: ({ procedures, to }) => {
        state = {
          ...state,
          procedures,
          to: to || state.to,
          attendance: '',
        };
        render();
      },
    });
  };

  const openRecordTransferSelector = () => {
    const layer = mountModal(document.body, modal(
      `<div class="compact-form">${select({
        label: 'Изменить',
        name: 'recordEditStep',
        value: '',
        options: [
          { value: '', label: 'Без выбора' },
          { value: 'workplace', label: 'Пространство' },
          { value: 'date', label: 'Дата' },
          { value: 'time', label: 'Время' },
        ],
        aria: 'Выберите этап переноса записи',
      })}</div>`,
      { variant: 'x', surface: 'app', title: 'Перенос', className: 'modal--form-sheet' },
    ));
    const input = layer?.querySelector('input[name="recordEditStep"]');
    input?.addEventListener('change', () => {
      const startAt = String(input.value || '');
      if (!startAt) return;
      layer.v2Close?.();
      openRecordEdit(startAt);
    });
  };

  const confirmHardDelete = () => {
    const layer = mountModal(document.body, modal(
      `<div class="modal-title"><h2>Удалить запись полностью?</h2><p>Запись, её история и связанные данные оплаты будут удалены без восстановления.</p></div>
      <div class="modal-actions">${button('Удалить', { variant: 'critical', data: 'data-record-hard-delete-confirm' })}</div>`,
      { variant: 'x', surface: 'app', title: 'Удалить запись', className: 'modal--form-sheet' },
    ));
    layer?.querySelector('[data-record-hard-delete-confirm]')?.addEventListener('click', async (event) => {
      const submit = event.currentTarget;
      if (submit) submit.disabled = true;
      if (!deleteRecord(record.id)) {
        if (submit) submit.disabled = false;
        return;
      }
      try {
        await flushBusinessPersistence();
        await Promise.all([
          refreshRecordsFromServer(),
          refreshFinanceState(),
        ]);
        layer.v2Close?.();
        m.v2Close?.();
      } catch (error) {
        await Promise.all([
          refreshRecordsFromServer().catch(() => null),
          refreshFinanceState().catch(() => null),
        ]);
        openNotice({ title: 'Не удалось удалить', message: String(error?.message || 'Сервер не подтвердил удаление записи.') });
        if (submit?.isConnected) submit.disabled = false;
      }
    });
  };

  const render = () => {
    scheduleStartRender();
    const paid = isPaid();
    const currentRecord = getRecords().find((item) => String(item?.id || '') === String(record.id)) || record;
    const cancelled = currentRecord?.status === 'cancelled';
    const personSource = state.person || findPerson(record) || {};
    const currentPerson = personSource?.key
      ? people().find((person) => String(person.key) === String(personSource.key)) || personSource
      : personSource;
    const person = personDisplay(currentPerson);
    const workplace = workplaceName(state.workplaceId);
    const totalDuration = state.procedures.length ? procedureTotalDuration(state.procedures) : 30;
    const finance = repriceSettlement(recordSettlementItems(state), state.finance);
    const discountPercent = finance?.discountPercent;
    const card = recordConfirmationMiniCard({
      workplace,
      date: formatDate(state.date),
      period: `${state.from} - ${state.to}`,
      uei: person.uei,
      name: person.name,
      phone: person.phone,
      groupText: state.group ? `Участники: ${Array.isArray(state.group.participants) ? state.group.participants.length : 0} / ${Math.max(2, Math.floor(Number(state.group.capacity) || 2))}` : '',
      duration: durationText(totalDuration),
      discount: Number(discountPercent) > 0 ? `${formatPercent(discountPercent)}%` : '0%',
      total: formatMoney(finance?.planTotal),
      procedures: [
        ...state.procedures.map((item, index) => ({
          name: item.name || '',
          right: item.cost === '' || item.cost == null ? '' : formatMoney(item.cost),
          ...(!paid && !cancelled ? {
            action: {
              label: '⚙',
              className: 'record-procedure-settings-button',
              data: `data-record-view-procedure-edit="${index}"`,
              aria: `Настройки процедуры ${item.name || ''}`,
            },
          } : {}),
        })),
        ...state.products.map((item) => ({
          name: item.name || '',
          right: item.cost === '' || item.cost == null ? '' : formatMoney(item.cost),
        })),
      ],
    });

    const started = hasAppointmentStarted(state);
    const effectiveAttendance = normalizedAttendance(state.attendance) || (started ? 'arrived' : '');
    const confirmedControl = `<div class="segment-control segment-control--one" role="group" aria-label="Подтверждение записи">
      <button type="button" class="${paid || state.confirmed ? 'is-active' : ''}" aria-pressed="${paid || state.confirmed}" data-record-view-confirmed${paid ? ' disabled' : ''}>Подтвердил</button>
    </div>`;
    const attendanceControl = `<div class="segment-control segment-control--two-equal" role="group" aria-label="Посещение записи">
      <button type="button" class="${effectiveAttendance === 'arrived' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'arrived'}" data-record-view-attendance="arrived"${!started ? ' disabled' : ''}>Пришел</button>
      <button type="button" class="${effectiveAttendance === 'no-show' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'no-show'}" data-record-view-attendance="no-show"${!started ? ' disabled' : ''}>Не пришел</button>
    </div>`;
    setV2ZHeaderRows(m, [confirmedControl, attendanceControl]);
    const dirty = stateSnapshot(state) !== baseline;
    root.innerHTML = `<div class="record-screen record-screen--state-view">${card}</div>`;
    if (dirty) {
      setRecordPrimaryAction(m, {
        label: 'Сохранить',
        onClick: persistChanges,
      });
    } else {
      const paymentState = getRecordPaymentState({ ...record, ...state, id: record.id, finance });
      setRecordPrimaryAction(m, {
        label: paymentState.fullyPaid
          ? 'Оплачено'
          : formatMoney(paymentState.remaining),
        variant: paymentState.fullyPaid ? 'secondary' : '',
        onClick: () => openRecordPayment(
          getRecords().find((item) => String(item?.id || '') === String(record.id)) || { ...record, ...state, id: record.id },
          { host: m },
        ),
      });
    }

    root.querySelectorAll('[data-record-view-procedure-edit]').forEach((node) => node.addEventListener('click', () => {
      const index = Number(node.dataset.recordViewProcedureEdit);
      if (!Number.isInteger(index) || !state.procedures[index]) return;
      openProcedureCorrection(index);
    }));
    m.querySelector('[data-record-view-confirmed]')?.addEventListener('click', () => {
      if (isPaid()) return;
      applyPatch({ confirmed: !state.confirmed });
    });
    m.querySelectorAll('[data-record-view-attendance]').forEach((node) => node.addEventListener('click', () => {
      if (!hasAppointmentStarted(state)) return;
      const next = normalizedAttendance(node.dataset.recordViewAttendance);
      const current = normalizedAttendance(state.attendance) || 'arrived';
      if (!next || next === current) return;
      applyPatch({ attendance: next });
    }));

  };

  const syncFromStoredRecord = ({ paid = isPaid() } = {}) => {
    const current = getRecords().find((item) => String(item?.id || '') === String(record.id));
    if (!current) return;
    state = stateFromRecord(current, { paid });
    baseline = stateSnapshot(state);
    render();
  };
  const onRecordsChanged = (event) => {
    if (updatingFromView || String(event?.detail?.recordId || '') !== String(record.id)) return;
    syncFromStoredRecord();
  };
  const onDDSChanged = (event) => {
    if (event?.detail?.action === 'server-refresh') {
      syncFromStoredRecord();
      return;
    }
    const source = event?.detail?.source;
    if (String(source?.type || '') !== 'record' || String(source?.id || '') !== String(record.id)) return;
    syncFromStoredRecord();
  };
  const onPeopleChanged = () => render();
  window.addEventListener('book:records-changed', onRecordsChanged);
  window.addEventListener('book:dds-changed', onDDSChanged);
  window.addEventListener('book:people-changed', onPeopleChanged);

  let closed = false;
  finishClose = () => {
    if (closed) return;
    closed = true;
    if (startTimer) clearTimeout(startTimer);
    startTimer = null;
    window.removeEventListener('book:records-changed', onRecordsChanged);
    window.removeEventListener('book:dds-changed', onDDSChanged);
    window.removeEventListener('book:people-changed', onPeopleChanged);
    queueMicrotask(() => onClose?.());
  };

  bindRecordSettings(m, () => {
    const current = getRecords().find((item) => String(item?.id || '') === String(record.id)) || record;
    const cancelled = current?.status === 'cancelled';
    openSharedProfileSettingsMenu({
      title: 'Настройки записи',
      actions: [
        !cancelled ? {
          id: 'move',
          label: 'Перенос',
          onSelect: openRecordTransferSelector,
        } : null,
        !cancelled ? {
          id: 'cancel',
          label: 'Отмена',
          variant: 'danger',
          onSelect: () => confirmCancel(current, () => m.v2Close?.()),
        } : null,
        {
          id: 'delete',
          label: 'Удалить',
          variant: 'critical',
          onSelect: confirmHardDelete,
        },
      ].filter(Boolean),
    });
  });

  render();
}