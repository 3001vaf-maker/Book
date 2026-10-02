import {
  button,
  durationPicker,
  durationText,
  escapeHtml,
  field,
  initCalendar,
  initDurationPickers,
  initMultiSelect,
  list,
  select,
  openSharedProfileSettingsMenu,
  modal,
  mountModal,
  openNotice,
  openTimePickerAction,
  mountRecordZ,
  recordZHost,
  recordProcedureList,
  recordPersonList,
  recordConfirmationMiniCard,
  setRecordPrimaryAction,
  bindRecordSettings,
} from '../ui/ui.js';
import { getRecordPaymentState, recordSettlementItems, repriceSettlement, refreshFinanceState } from '../core/finance/index.js';
import { getWorkplaces, getWorkplaceWorkingDates } from '../core/workplace-time.js';
import { timeToMinutes, minutesToTime } from '../core/time/index.js';
import { getAllPeople } from '../core/people/data.js';
import { personDisplay } from '../core/people/presentation.js';
import { openPerson } from '../core/people/people.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { getProducts } from '../settings/service/products/data.js';
import { getRecords } from '../core/record/index.js';
import { updateRecord, cancelRecord, deleteRecord, checkRecordTime, refreshRecordsFromServer } from '../core/record/index.js';
import { journalRecordActionContext } from './record-action-context.js';
import { getProfile } from '../settings/profile/data.js';
import { openRecordPayment } from './record-payment.js';
import { openRecordEditFlow } from './record.js';
import { flushBusinessPersistence } from '../core/business-persistence.js';

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

const people = () => getAllPeople();
const procedures = () => getProcedures();
const products = () => getProducts();
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

function productAvailable(product, workplaceId) {
  const assigned = Array.isArray(product?.workplaces) ? product.workplaces : [];
  return !assigned.length || Boolean(workplaceAssignment(product, workplaceId));
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
  const workingDates = getWorkplaceWorkingDates(state.workplaceId);
  if (!workingDates.length) {
    openNotice({ title: 'Нет рабочего дня', message: 'Для этого рабочего пространства нет доступных рабочих дат.' });
    return;
  }
  const value = state.date instanceof Date ? state.date : new Date(`${state.date}T00:00:00`);
  const content = '<div data-record-view-date-calendar></div>';
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  const calendarRoot = m.querySelector('[data-record-view-date-calendar]');
  initCalendar(calendarRoot, {
    month: Number.isNaN(value.getTime()) ? new Date(`${workingDates[0]}T00:00:00`) : value,
    selectedValue: dateKey(state.date),
    workingDates,
    onDateSelect: (key) => {
      if (!workingDates.includes(String(key || ''))) return;
      const [year, month, day] = String(key || '').split('-').map(Number);
      if (!year || !month || !day) return;
      m.remove();
      onSelected?.(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    },
  });
}

function openTimePicker(state, record, onSelected) {
  const duration = procedureTotalDuration(state.procedures) || 30;
  return openTimePickerAction({
    value: state.from,
    minuteStep: 1,
    title: 'Время',
    onSave: (from) => {
      const start = timeToMinutes(from);
      const to = start == null ? '' : minutesToTime(start + duration);
      if (!from || !to) return;
      const check = checkRecordTime({
        date: dateKey(state.date),
        workplaceId: state.workplaceId,
        from,
        to,
        excludeId: record?.id || '',
      });
      if (!check.ok) {
        openNotice({
          title: 'Недостаточно времени',
          message: check.reason === 'occupied'
            ? 'Это время уже занято. Выберите другое время.'
            : 'Это время находится вне рабочего периода. Выберите другое время.',
        });
        return;
      }
      onSelected?.({ from, to });
    },
  });
}

function openPersonPicker(state, onSelected) {
  const content = `<div class="record-editor-screen record-editor-screen--people"><div class="ui-search-field">${field({ name: 'recordViewPersonSearch', type: 'search', placeholder: 'Поиск по имени или UEI', autocomplete: 'off', data: 'data-record-view-person-search' })}</div><div class="ui-search-divider" aria-hidden="true"></div><div class="record-person-list" data-record-view-person-list></div></div>`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app', className: 'record-editor-modal' }));
  if (!m) return;
  const render = (query = '') => {
    const normalized = String(query || '').trim().toLowerCase();
    const matches = people().filter((person) => {
      const display = personDisplay(person);
      return !normalized || `${display.uei} ${display.name} ${display.phone}`.toLowerCase().includes(normalized);
    });
    const listRoot = m.querySelector('[data-record-view-person-list]');
    if (!listRoot) return;
    listRoot.innerHTML = recordPersonList(matches.map((person) => {
      const display = personDisplay(person);
      return {
        key: person.key,
        name: display.name,
        uei: display.uei,
        phone: display.phone,
        aria: `Выбрать человека ${display.name}`,
      };
    }), {
      data: 'data-record-view-person',
      selected: state.person?.key || '',
      empty: 'Люди не найдены.',
    });
    listRoot.querySelectorAll('[data-record-view-person]').forEach((node) => node.addEventListener('click', () => {
      const person = people().find((item) => String(item.key || '') === String(node.dataset.recordViewPerson || ''));
      if (!person) return;
      m.remove();
      const display = personDisplay(person);
      onSelected?.({ key: person.key, id: person.id, uei: display.uei, name: person.name, surname: person.surname, phone: display.phone, discountPercent: Number(person.discountPercent) || 0 });
    }));
  };
  const search = m.querySelector('[data-record-view-person-search]');
  search?.addEventListener('input', () => render(search.value));
  render();
}

function openAddProcedurePicker(state, onSelected) {
  const available = procedures().filter((procedure) => workplaceAssignment(procedure, state.workplaceId));
  const content = `<div class="modal-title"><h2>Добавить процедуру</h2></div>${recordProcedureList(available.map((procedure) => ({
    id: String(procedure.id || ''),
    name: procedure.name || 'Процедура',
    durationText: durationText(Number(workplaceAssignment(procedure, state.workplaceId)?.duration ?? procedure.duration) || 0),
    costText: defaultCost(procedure, state.workplaceId) !== '' ? formatMoney(defaultCost(procedure, state.workplaceId)) : '',
    aria: `Добавить процедуру ${procedure.name || ''}`,
  })), {
    data: 'data-record-view-procedure-add-select',
    empty: 'Процедур нет.',
  })}`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  m.querySelectorAll('[data-record-view-procedure-add-select]').forEach((node) => node.addEventListener('click', () => {
    const procedure = available.find((item) => String(item.id || '') === String(node.dataset.recordViewProcedureAddSelect || ''));
    if (!procedure) return;
    const assignment = workplaceAssignment(procedure, state.workplaceId);
    const duration = Number(assignment?.duration ?? procedure.duration) || 0;
    onSelected?.({ id: procedure.id, name: procedure.name || '', cost: defaultCost(procedure, state.workplaceId), duration });
    m.remove();
  }));
}

function openSalePicker(state, onSave) {
  const available = products().filter((product) => productAvailable(product, state.workplaceId));
  const selected = new Set((state.products || []).map((item) => String(item?.id || '')).filter(Boolean));
  const currentById = new Map((state.products || []).map((item) => [String(item?.id || ''), item]));
  const items = available.map((product) => {
    const cost = currentById.get(String(product.id || ''))?.cost ?? defaultCost(product, state.workplaceId);
    return {
      title: product.name || 'Товар',
      secondary: cost === '' || cost == null ? '' : formatMoney(cost),
      interactive: true,
      selected: selected.has(String(product.id || '')),
      data: `data-record-sale-product="${escapeHtml(product.id || '')}"`,
      aria: `Выбрать товар ${product.name || ''}`,
    };
  });
  const content = `<div class="modal-title"><h2>Продажа</h2></div><div data-record-sale-products>${list({ items }) || '<div class="muted">Товаров пока нет.</div>'}</div><div class="modal-actions">${button('Сохранить', { data: 'data-record-sale-save' })}</div>`;
  const m = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  const listRoot = m.querySelector('[data-record-sale-products]');
  const controller = listRoot && available.length ? initMultiSelect(listRoot, {
    selectedValues: [...selected],
    selector: '[data-record-sale-product]',
    valueAttribute: 'recordSaleProduct',
    onChange: (values) => {
      selected.clear();
      values.forEach((value) => selected.add(String(value)));
    },
  }) : null;
  m.querySelector('[data-record-sale-save]')?.addEventListener('click', () => {
    const nextProducts = available
      .filter((product) => selected.has(String(product.id || '')))
      .map((product) => {
        const current = currentById.get(String(product.id || ''));
        return current ? { ...current } : {
          id: product.id,
          name: product.name || '',
          cost: defaultCost(product, state.workplaceId),
        };
      });
    controller?.destroy();
    m.remove();
    onSave?.(nextProducts);
  });
}

function openProcedureCorrection(state, index, { onSave, onAdd, onDelete } = {}) {
  const item = state.procedures[index];
  if (!item) return;
  const duration = Number(item.duration) || 0;
  const durationField = durationPicker({ name: 'recordViewProcedureDuration', label: 'Время', value: duration });
  const html = `<div class="modal-title"><h2>${escapeHtml(item.name || 'Процедура')}</h2><p>Скорректируйте время процедуры для этой записи.</p></div><div class="compact-form">${durationField}<div class="modal-actions">${button('Сохранить', { data: 'data-record-view-procedure-save' })}${button('+ Добавить процедуру', { data: 'data-record-view-procedure-add', variant: 'secondary' })}${button('Удалить процедуру', { data: 'data-record-view-procedure-delete', variant: 'danger' })}</div></div>`;
  const m = mountModal(document.body, modal(html, { variant: 'medium', surface: 'app' }));
  if (!m) return;
  initDurationPickers(m);
  m.querySelector('[data-record-view-procedure-add]')?.addEventListener('click', () => {
    m.remove();
    onAdd?.();
  });
  m.querySelector('[data-record-view-procedure-delete]')?.addEventListener('click', () => {
    m.remove();
    onDelete?.();
  });
  m.querySelector('[data-record-view-procedure-save]')?.addEventListener('click', () => {
    const durationValue = Number(m.querySelector('[data-duration-value]')?.value);
    onSave?.({
      ...item,
      duration: Number.isFinite(durationValue) ? durationValue : duration,
    });
    m.remove();
  });
}

function openProductRemoval(state, index, onDelete) {
  const item = state.products[index];
  if (!item) return;
  const html = `<div class="modal-title"><h2>${escapeHtml(item.name || 'Товар')}</h2></div><div class="modal-actions">${button('Удалить товар', { data: 'data-record-view-product-delete', variant: 'danger' })}</div>`;
  const m = mountModal(document.body, modal(html, { variant: 'compact', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-record-view-product-delete]')?.addEventListener('click', () => {
    m.remove();
    onDelete?.();
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
  m.querySelector('[data-record-phone-call]')?.addEventListener('click', () => {
    window.location.href = `tel:${value.replace(/[^\d+]/g, '')}`;
  });
  m.querySelector('[data-record-phone-write]')?.addEventListener('click', () => {
    m.remove();
    mountModal(document.body, modal('<div class="muted">Чат в разработке</div>', { variant: 'compact' }));
  });
}

function confirmCancel(record, onCancelled) {
  const content = `<div class="modal-title"><h2>Отменить запись?</h2><p>Запись останется в истории как отменённая и освободит это время.</p></div><div class="modal-actions">${button('Нет', { data: 'data-record-cancel-no', variant: 'secondary' })}${button('Отменить запись', { data: 'data-record-cancel-yes', variant: 'danger' })}</div>`;
  const m = mountModal(document.body, modal(content, { variant: 'bottom', surface: 'app' }));
  if (!m) return;
  m.querySelector('[data-record-cancel-no]')?.addEventListener('click', () => m.remove());
  m.querySelector('[data-record-cancel-yes]')?.addEventListener('click', () => {
    if (!cancelRecord(record.id, { actionContext: journalRecordActionContext() })) return;
    m.remove();
    onCancelled?.();
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
  const m = mountRecordZ({
    ...recordOwnerOptions({ settings: true, chatPersonKey: state.person?.key || '' }),
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

  const chooseTimeForDraft = (draft, onSelected) => {
    openTimePicker(draft, original, ({ from, to }) => onSelected?.({ ...draft, from, to }));
  };

  const startDateEdit = (draft, onSelected) => {
    openDatePicker(draft, (date) => {
      const datedDraft = { ...draft, date };
      chooseTimeForDraft(datedDraft, (scheduledDraft) => onSelected?.(scheduledDraft));
    });
  };

  const startWorkplaceEdit = () => {
    openWorkplacePicker(state, (workplaceId) => {
      const workplaceDraft = { ...state, workplaceId };
      startDateEdit(workplaceDraft, (scheduledDraft) => applyPatch({
        workplaceId: scheduledDraft.workplaceId,
        date: scheduledDraft.date,
        from: scheduledDraft.from,
        to: scheduledDraft.to,
      }));
    });
  };

  const startRecordDateEdit = () => {
    startDateEdit({ ...state }, (scheduledDraft) => applyPatch({
      date: scheduledDraft.date,
      from: scheduledDraft.from,
      to: scheduledDraft.to,
    }));
  };

  const startRecordTimeEdit = () => {
    chooseTimeForDraft({ ...state }, (scheduledDraft) => applyPatch({
      from: scheduledDraft.from,
      to: scheduledDraft.to,
    }));
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
      openNotice({ title: 'Недостаточно времени', message: 'Новая длительность не помещается в свободный интервал. Выберите другое время.' });
      return;
    }
    const patch = { procedures: nextProcedures };
    if (nextTo !== state.to) patch.to = nextTo;
    applyPatch(patch);
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
    if (isPaid()) return;
    const start = appointmentStart(state);
    if (!start) return;
    const delay = start.getTime() - Date.now();
    if (delay <= 0) return;
    startTimer = setTimeout(() => render(), Math.min(delay + 50, 2147483647));
  };

  const openRecordEditSelector = () => {
    const paid = isPaid();
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
          ...(!paid ? [{ value: 'procedure', label: 'Процедура' }] : []),
        ],
        aria: 'Выберите этап переноса записи',
      })}</div>`,
      { variant: 'bottom', surface: 'app', title: 'Перенос' },
    ));
    const input = layer?.querySelector('input[name="recordEditStep"]');
    input?.addEventListener('change', () => {
      const startAt = String(input.value || '');
      if (!startAt) return;
      layer.v2Close?.();
      openRecordEditFlow({
        startAt,
        date: state.date,
        workplaceId: state.workplaceId,
        from: state.from,
        to: state.to,
        selectedProcedures: state.procedures,
        excludeId: record.id,
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
    });
  };

  const confirmHardDelete = () => {
    const layer = mountModal(document.body, modal(
      `<div class="modal-title"><h2>Удалить запись полностью?</h2><p>Запись, её история и связанные данные оплаты будут удалены без восстановления.</p></div>
      <div class="modal-actions">${button('Удалить', { variant: 'critical', data: 'data-record-hard-delete-confirm' })}</div>`,
      { variant: 'bottom', surface: 'app', title: 'Удалить запись' },
    ));
    layer?.querySelector('[data-record-hard-delete-confirm]')?.addEventListener('click', async () => {
      if (!deleteRecord(record.id)) return;
      try {
        await flushBusinessPersistence();
        await refreshFinanceState();
        layer.v2Close?.();
        m.v2Close?.();
      } catch (error) {
        openNotice({ title: 'Не удалось удалить', message: String(error?.message || 'Сервер не подтвердил удаление записи.') });
      }
    });
  };

  const render = () => {
    scheduleStartRender();
    const paid = isPaid();
    const personSource = state.person || findPerson(record) || {};
    const currentPerson = personSource?.key
      ? people().find((person) => String(person.key) === String(personSource.key)) || personSource
      : personSource;
    const person = personDisplay(currentPerson);
    const workplace = workplaceName(state.workplaceId);
    const totalDuration = state.procedures.length ? procedureTotalDuration(state.procedures) : 30;
    const finance = repriceSettlement(recordSettlementItems(state), state.finance);
    const discountTotal = Math.max(0, Number(finance?.discountTotal) || 0);
    const discountPercent = finance?.discountPercent;
    const card = recordConfirmationMiniCard({
      workplace,
      date: formatDate(state.date),
      period: `${state.from} - ${state.to}`,
      uei: person.uei,
      name: person.name,
      phone: person.phone,
      duration: durationText(totalDuration),
      discount: Number(discountPercent) > 0 ? `${formatPercent(discountPercent)}%` : '0%',
      total: formatMoney(finance?.planTotal),
      procedures: [
        ...state.procedures.map((item) => ({
          name: item.name || '',
          right: item.cost === '' || item.cost == null ? '' : formatMoney(item.cost),
        })),
        ...state.products.map((item) => ({
          name: item.name || '',
          right: item.cost === '' || item.cost == null ? '' : formatMoney(item.cost),
        })),
      ],
    });

    const started = hasAppointmentStarted(state);
    const effectiveAttendance = normalizedAttendance(state.attendance) || (paid || started ? 'arrived' : '');
    const statusControl = `<div class="record-status-controls">
      <div class="segment-control segment-control--one" role="group" aria-label="Подтверждение записи">
        <button type="button" class="${paid || state.confirmed ? 'is-active' : ''}" aria-pressed="${paid || state.confirmed}" data-record-view-confirmed${paid ? ' disabled' : ''}>Подтвердил</button>
      </div>
      <div class="segment-control segment-control--two-equal" role="group" aria-label="Посещение записи">
        <button type="button" class="${effectiveAttendance === 'arrived' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'arrived'}" data-record-view-attendance="arrived"${!started ? ' disabled' : ''}>Пришел</button>
        <button type="button" class="${effectiveAttendance === 'no-show' ? 'is-active' : ''}" aria-pressed="${effectiveAttendance === 'no-show'}" data-record-view-attendance="no-show"${!started ? ' disabled' : ''}>Не пришел</button>
      </div>
    </div>`;
    const dirty = stateSnapshot(state) !== baseline;
    root.innerHTML = `<div class="record-screen record-screen--state-view">${card}${statusControl}</div>`;
    if (dirty) {
      setRecordPrimaryAction(m, {
        label: 'Сохранить',
        onClick: persistChanges,
      });
    } else if (!paid) {
      const paymentState = getRecordPaymentState({ ...record, ...state, id: record.id, finance });
      setRecordPrimaryAction(m, {
        label: `К оплате · ${formatMoney(paymentState.remaining)}`,
        onClick: () => openRecordPayment(getRecords().find((item) => String(item?.id || '') === String(record.id)) || { ...record, ...state, id: record.id }),
      });
    } else {
      setRecordPrimaryAction(m);
    }

    root.querySelector('[data-record-view-workplace-edit]')?.addEventListener('click', () => {
      if (isPaid()) return;
      startWorkplaceEdit();
    });
    root.querySelector('[data-record-view-date-edit]')?.addEventListener('click', () => {
      if (isPaid()) return;
      startRecordDateEdit();
    });
    root.querySelector('[data-record-view-time-edit]')?.addEventListener('click', () => {
      if (isPaid()) return;
      startRecordTimeEdit();
    });
    root.querySelectorAll('[data-record-view-person-profile]').forEach((node) => node.addEventListener('click', () => {
      if (!currentPerson?.key) return;
      openPerson({ root: document.body, key: currentPerson.key, onClose: render });
    }));
    root.querySelector('[data-record-view-phone]')?.addEventListener('click', () => openPhoneActions(person.phone));
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
    root.querySelectorAll('[data-record-view-product-edit]').forEach((node) => node.addEventListener('click', () => {
      if (isPaid()) return;
      const index = Number(node.dataset.recordViewProductEdit);
      if (!Number.isInteger(index) || !state.products[index]) return;
      openProductRemoval(state, index, () => {
        state = {
          ...state,
          products: state.products.filter((_, itemIndex) => itemIndex !== index).map((item) => ({ ...item })),
        };
        persistChanges();
      });
    }));
    root.querySelector('[data-record-view-confirmed]')?.addEventListener('click', () => {
      if (isPaid()) return;
      applyPatch({ confirmed: !state.confirmed });
    });
    root.querySelectorAll('[data-record-view-attendance]').forEach((node) => node.addEventListener('click', () => {
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
          onSelect: openRecordEditSelector,
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
