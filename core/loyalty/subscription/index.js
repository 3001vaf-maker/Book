import {
  datePicker,
  emptyState,
  entityCardStack,
  field,
  formValidationMessage,
  initDatePickers,
  modal,
  mountModal,
  mountV2ZLayer,
  page,
  select,
  shortDateTime,
  textareaField,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
} from '../../../ui/ui.js';
import { getProcedures } from '../../service/procedures/data.js';
import {
  availablePeople,
  bindViewSettings,
  formObject,
  loyaltyCardFields,
  loyaltyHeader,
  loyaltyVisualCard,
  money,
  mockPerson,
  notifyLoyaltyContext,
  personLabel,
  personOption,
  text,
  uid,
} from '../shared.js';

const fallbackPeople = [
  mockPerson('Иван Петров', 'mock-person-1'),
  mockPerson('Анна Иванова', 'mock-person-2'),
  mockPerson('Мария Смирнова', 'mock-person-3'),
];

let programs = [
  {
    id: 'subscription-10', name: '10 посещений', description: 'Десять использований выбранной позиции.', price: 30000,
    compositionMode: 'common-limit', procedureIds: [], procedureNames: ['Стрижка'], commonLimit: 10, quantity1: 10, quantity2: 0,
    termType: 'duration', termValue: '12 месяцев', startRule: 'issue', frequencyPeriod: 'none', frequencyLimit: 0,
    multiplePerEvent: false, status: 'active', createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'subscription-unlimited', name: 'Годовой безлимит', description: 'Безлимит по выбранным позициям.', price: 90000,
    compositionMode: 'unlimited', procedureIds: [], procedureNames: ['Уход', 'Стрижка'], commonLimit: 0, quantity1: 0, quantity2: 0,
    termType: 'duration', termValue: '12 месяцев', startRule: 'first-use', frequencyPeriod: 'week', frequencyLimit: 2,
    multiplePerEvent: true, status: 'active', createdAt: '2026-10-02T10:00:00.000Z',
  },
];

let instances = [
  { id: 'subscription-instance-1', programId: 'subscription-10', personKey: 'mock-person-2', personName: 'Анна Иванова', issuedAt: '2026-10-03T12:00:00.000Z', used: 3, remaining: 7, status: 'active', startsAt: '2026-10-03', expiresAt: '2027-10-03', history: [
    { title: 'Использование', procedure: 'Стрижка', occurredAt: '2026-10-05T12:00:00.000Z' },
    { title: 'Использование', procedure: 'Стрижка', occurredAt: '2026-10-06T12:00:00.000Z' },
    { title: 'Использование', procedure: 'Стрижка', occurredAt: '2026-10-07T12:00:00.000Z' },
  ] },
];

function compositionLabel(program = {}) {
  if (program.compositionMode === 'unlimited') return 'Безлимит';
  if (program.compositionMode === 'per-position') return 'Лимиты по позициям';
  if (program.compositionMode === 'single') return 'Одна позиция';
  return `Общий лимит ${Math.max(0, Number(program.commonLimit || 0))}`;
}

function startLabel(value) {
  if (value === 'first-use') return 'С первого использования';
  if (value === 'date') return 'С конкретной даты';
  return 'С оформления / покупки';
}

function frequencyLabel(program = {}) {
  const count = Math.max(0, Number(program.frequencyLimit || 0));
  if (!count || program.frequencyPeriod === 'none') return 'Без ограничения частоты';
  if (program.frequencyPeriod === 'day') return `Не более ${count} в день`;
  if (program.frequencyPeriod === 'month') return `Не более ${count} в месяц`;
  return `Не более ${count} в неделю`;
}

function programCardFields(program = {}) {
  return loyaltyCardFields({
    title: program.name || 'Абонемент',
    subtitle: compositionLabel(program),
    status: program.status === 'active' ? 'Активен' : 'Закрыт',
    metaLeft: program.termType === 'indefinite' ? 'Бессрочно' : (program.termValue || '—'),
    metaRight: money(program.price),
  });
}

function instanceProgress(instance = {}, program = {}) {
  if (program.compositionMode === 'unlimited') return 'Безлимит';
  const initial = Math.max(0, Number(instance.used || 0) + Number(instance.remaining || 0));
  return `${Math.max(0, Number(instance.used || 0))} из ${initial}`;
}

function instanceCardFields(instance = {}, program = {}) {
  return loyaltyCardFields({
    title: instance.personName || 'Без имени',
    subtitle: program.name || 'Абонемент',
    status: instance.status === 'closed' ? 'Завершён' : 'Активен',
    metaLeft: program.compositionMode === 'unlimited' ? 'Безлимит' : `Осталось ${Math.max(0, Number(instance.remaining || 0))}`,
    metaRight: instanceProgress(instance, program),
  });
}

function programInfo(program = {}) {
  return v2ListEntries([
    ['Цена', money(program.price)],
    ['Состав', compositionLabel(program)],
    ['Позиции Сервиса', (program.procedureNames || []).filter(Boolean).join(' · ') || 'Не выбраны'],
    ['Срок', program.termType === 'indefinite' ? 'Бессрочно' : (program.termValue || '—')],
    ['Начало срока', startLabel(program.startRule)],
    ['Частота', frequencyLabel(program)],
    ['Несколько единиц за событие', program.multiplePerEvent ? 'Разрешено' : 'Нет'],
    ['Условия', program.description || '—'],
    ['Состояние', program.status === 'active' ? 'Активен' : 'Закрыт'],
  ].map(([title, subtitle]) => v2ListEntry({ title, subtitle: String(subtitle), interactive: false, initial: '' })));
}

function instanceInfo(instance = {}, program = {}) {
  return v2ListEntries([
    ['Владелец', instance.personName || '—'],
    ['Программа', program.name || '—'],
    ['Дата оформления', shortDateTime(instance.issuedAt, '—')],
    ['Исходный состав', compositionLabel(program)],
    ['Использовано', instanceProgress(instance, program)],
    ['Остаток', program.compositionMode === 'unlimited' ? 'Безлимит' : String(Math.max(0, Number(instance.remaining || 0)))],
    ['Начало', instance.startsAt || startLabel(program.startRule)],
    ['Срок', instance.expiresAt || program.termValue || 'Бессрочно'],
    ['Состояние', instance.status === 'closed' ? 'Завершён' : 'Активен'],
  ].map(([title, subtitle]) => v2ListEntry({ title, subtitle: String(subtitle), interactive: false, initial: '' })));
}

function historyMarkup(instance = {}) {
  const history = Array.isArray(instance.history) ? instance.history : [];
  if (!history.length) return emptyState('Использований пока нет', 'История появится после использования абонемента.');
  return v2ListEntries([...history].reverse().map((item) => v2ListEntry({
    title: item.title || 'Использование',
    subtitle: item.procedure || '',
    rightTop: shortDateTime(item.occurredAt, '—'),
    interactive: false,
    initial: '',
  })));
}

function procedureOptions() {
  const procedures = getProcedures();
  const options = procedures.map((item) => ({ value: String(item.id || ''), label: item.name || 'Позиция Сервиса' })).filter((item) => item.value);
  return [{ value: '', label: options.length ? 'Выберите позицию' : 'Позиции Сервиса пока не созданы' }, ...options];
}

function procedureNameById(id = '') {
  return getProcedures().find((item) => String(item.id || '') === String(id || ''))?.name || '';
}

async function openCreateProgramQ(root, rerender) {
  const serviceOptions = procedureOptions();
  const layer = mountModal(root, modal(`${loyaltyHeader('Новый абонемент', {
    c: { label: 'Сохранить', data: 'data-subscription-save', aria: 'Сохранить программу абонемента' },
  })}
    <form class="form-grid" data-subscription-form>
      ${field({ label: 'Название', name: 'name', required: true })}
      ${textareaField({ label: 'Описание / условия', name: 'description' })}
      ${field({ label: 'Цена', name: 'price', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
      ${select({ label: 'Модель состава', name: 'compositionMode', value: 'common-limit', options: [
        { value: 'single', label: 'Одна позиция с количеством' },
        { value: 'per-position', label: 'Несколько позиций с отдельным количеством' },
        { value: 'common-limit', label: 'Общий лимит на выбранные позиции' },
        { value: 'unlimited', label: 'Безлимит по выбранным позициям' },
      ] })}
      ${select({ label: 'Позиция Сервиса 1', name: 'procedure1', value: '', options: serviceOptions })}
      ${field({ label: 'Количество позиции 1', name: 'quantity1', type: 'number', min: '0', step: '1', inputmode: 'numeric' })}
      ${select({ label: 'Позиция Сервиса 2', name: 'procedure2', value: '', options: serviceOptions })}
      ${field({ label: 'Количество позиции 2', name: 'quantity2', type: 'number', min: '0', step: '1', inputmode: 'numeric' })}
      ${field({ label: 'Общий лимит', name: 'commonLimit', type: 'number', min: '0', step: '1', inputmode: 'numeric' })}
      ${select({ label: 'Срок действия', name: 'termType', value: 'duration', options: [
        { value: 'indefinite', label: 'Бессрочный' },
        { value: 'duration', label: 'N дней / месяцев / лет' },
        { value: 'date', label: 'До конкретной даты' },
      ] })}
      ${field({ label: 'Значение срока', name: 'termValue', placeholder: 'Например: 12 месяцев или 31.12.2027' })}
      ${select({ label: 'Начало срока', name: 'startRule', value: 'issue', options: [
        { value: 'issue', label: 'С оформления / покупки' },
        { value: 'first-use', label: 'С первого использования' },
        { value: 'date', label: 'С конкретной даты' },
      ] })}
      ${field({ label: 'Конкретная дата начала', name: 'startDate', type: 'date' })}
      ${select({ label: 'Ограничение частоты', name: 'frequencyPeriod', value: 'none', options: [
        { value: 'none', label: 'Без ограничения' },
        { value: 'day', label: 'Не более N раз в день' },
        { value: 'week', label: 'Не более N раз в неделю' },
        { value: 'month', label: 'Не более N раз в месяц' },
      ] })}
      ${field({ label: 'N использований', name: 'frequencyLimit', type: 'number', min: '0', step: '1', inputmode: 'numeric' })}
      ${select({ label: 'Несколько единиц за одно событие', name: 'multiplePerEvent', value: 'no', options: [{ value: 'no', label: 'Нет' }, { value: 'yes', label: 'Да' }] })}
      <div class="form-error" data-subscription-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Новый абонемент' }));
  if (!layer) return null;
  const form = layer.querySelector('[data-subscription-form]');
  layer.querySelector('[data-subscription-save]')?.addEventListener('click', async () => {
    const error = layer.querySelector('[data-subscription-error]');
    const validation = formValidationMessage(form);
    if (validation) { if (error) error.textContent = validation; return; }
    const values = formObject(form);
    const procedureIds = [values.procedure1, values.procedure2].filter(Boolean);
    const procedureNames = procedureIds.map(procedureNameById).filter(Boolean);
    const commonLimit = Math.max(0, Number(values.commonLimit || 0));
    const quantity1 = Math.max(0, Number(values.quantity1 || 0));
    const quantity2 = Math.max(0, Number(values.quantity2 || 0));
    if (values.compositionMode !== 'unlimited' && !commonLimit && !quantity1 && !quantity2) {
      if (error) error.textContent = 'Укажите количество или общий лимит';
      return;
    }
    programs.push({
      id: uid('subscription-program'),
      name: values.name,
      description: values.description || '',
      price: Math.max(0, Number(String(values.price || '0').replace(',', '.')) || 0),
      compositionMode: values.compositionMode || 'common-limit',
      procedureIds,
      procedureNames,
      commonLimit,
      quantity1,
      quantity2,
      termType: values.termType || 'duration',
      termValue: values.termValue || '',
      startRule: values.startRule || 'issue',
      startDate: values.startDate || '',
      frequencyPeriod: values.frequencyPeriod || 'none',
      frequencyLimit: Math.max(0, Number(values.frequencyLimit || 0)),
      multiplePerEvent: values.multiplePerEvent === 'yes',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    layer.v2Close?.();
    await rerender?.();
  });
  notifyLoyaltyContext();
  return layer;
}

function openConditionsS(root, program) {
  return mountModal(root, modal(programInfo(program), { variant: 's', surface: 'app', title: program.name || 'Условия абонемента' }));
}

async function openIssueQ(root, program, rerender) {
  const people = availablePeople(fallbackPeople);
  const options = [{ value: '', label: 'Выберите человека' }, ...people.map(personOption).filter((item) => item.value)];
  const layer = mountModal(root, modal(`${loyaltyHeader('Оформить абонемент', {
    c: { label: 'Оформить', data: 'data-subscription-issue-save', aria: 'Оформить абонемент' },
  })}
    <form class="form-grid" data-subscription-issue-form>
      ${select({ label: 'Владелец', name: 'personKey', value: '', options })}
      ${field({ label: 'Цена', name: 'price', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: program.price || 0 })}
      ${datePicker({ label: 'Дата оформления', name: 'issuedAt', value: new Date().toISOString().slice(0, 10), showYear: true, modalVariant: 'bottom', modalSurface: 'app', allowClear: false })}
      ${field({ label: 'Дата начала / правило', name: 'startsAt', placeholder: startLabel(program.startRule) })}
      ${field({ label: 'Срок / дата окончания', name: 'expiresAt', placeholder: program.termType === 'indefinite' ? 'Бессрочно' : program.termValue })}
      <div class="form-error" data-subscription-issue-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Оформить абонемент' }));
  if (!layer) return null;
  initDatePickers(layer);
  const form = layer.querySelector('[data-subscription-issue-form]');
  layer.querySelector('[data-subscription-issue-save]')?.addEventListener('click', async () => {
    const values = formObject(form);
    const error = layer.querySelector('[data-subscription-issue-error]');
    const person = people.find((item) => String(item?.key || item?.id || '') === String(values.personKey || ''));
    if (!person) { if (error) error.textContent = 'Укажите владельца'; return; }
    const total = program.compositionMode === 'unlimited'
      ? 0
      : Math.max(0, Number(program.commonLimit || 0) || Number(program.quantity1 || 0) + Number(program.quantity2 || 0));
    instances.push({
      id: uid('subscription-instance'),
      programId: program.id,
      personKey: String(person.key || person.id || ''),
      personName: personLabel(person),
      issuedAt: new Date(`${values.issuedAt}T12:00:00`).toISOString(),
      used: 0,
      remaining: total,
      status: 'active',
      startsAt: values.startsAt || startLabel(program.startRule),
      expiresAt: values.expiresAt || (program.termType === 'indefinite' ? 'Бессрочно' : program.termValue),
      history: [],
    });
    layer.v2Close?.();
    await rerender?.();
  });
  notifyLoyaltyContext();
  return layer;
}

async function openInstanceLayer(root, instanceId) {
  const instance = instances.find((item) => item.id === instanceId);
  if (!instance) return null;
  const program = programs.find((item) => item.id === instance.programId) || {};
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-subscription-instance-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(program.name || 'Абонемент'),
    v2Section('Абонемент', instanceInfo(instance, program)),
    v2Section('История использования', historyMarkup(instance)),
  ]);
  notifyLoyaltyContext();
  return layer;
}

async function openProgramLayer(root, programId, onChanged) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-subscription-program-z' }), { stack: true });
  if (!layer) return null;
  const render = async () => {
    const program = programs.find((item) => item.id === programId);
    if (!program) { layer.v2Close?.(); return; }
    const issued = instances.filter((item) => item.programId === program.id);
    layer.innerHTML = page([
      loyaltyHeader(program.name || 'Абонемент', {
        c: { label: 'Оформить', data: 'data-subscription-issue', aria: 'Оформить абонемент' },
      }),
      v2ListEntries([
        v2ListEntry({ title: 'Условия программы', subtitle: compositionLabel(program), rightTop: '[i]', interactive: true, initial: '', data: 'data-subscription-info', aria: 'Открыть условия программы' }),
      ]),
      v2Section('Участники', issued.length ? entityCardStack(issued.map((item) => loyaltyVisualCard('subscription', instanceCardFields(item, program), {
        data: `data-subscription-instance="${item.id}"`,
        aria: `Открыть абонемент ${item.personName || ''}`,
      }))) : emptyState('Экземпляров пока нет', 'Оформите абонемент конкретному человеку.')),
    ]);
    layer.querySelector('[data-subscription-info]')?.addEventListener('click', () => openConditionsS(root, program));
    layer.querySelector('[data-subscription-issue]')?.addEventListener('click', () => openIssueQ(root, program, async () => {
      await render();
      await onChanged?.();
    }));
    layer.querySelectorAll('[data-subscription-instance]').forEach((node) => node.addEventListener('click', () => openInstanceLayer(root, text(node.dataset.subscriptionInstance))));
    notifyLoyaltyContext();
  };
  await render();
  return layer;
}

export async function renderSubscription(root) {
  const render = async () => {
    const cards = programs.length ? entityCardStack(programs.map((program) => loyaltyVisualCard('subscription', programCardFields(program), {
      data: `data-subscription-program="${program.id}"`,
      aria: `Открыть ${program.name}`,
    }))) : emptyState('Абонементов пока нет', 'Создайте первую программу кнопкой «+».');

    root.innerHTML = page([
      loyaltyHeader('Абонемент', {
        settings: true,
        c: { label: '+', data: 'data-subscription-create', aria: 'Создать программу абонемента' },
      }),
      cards,
    ]);
    bindViewSettings(root, 'Абонемент', {
      type: 'subscription',
      fields: () => programCardFields(programs[0] || { name: 'Абонемент', price: 30000, compositionMode: 'common-limit', commonLimit: 10, termType: 'duration', termValue: '12 месяцев', status: 'active' }),
      onSaved: render,
    });
    root.querySelector('[data-subscription-create]')?.addEventListener('click', () => openCreateProgramQ(root, render));
    root.querySelectorAll('[data-subscription-program]').forEach((node) => node.addEventListener('click', () => openProgramLayer(root, text(node.dataset.subscriptionProgram), render)));
    notifyLoyaltyContext();
  };
  await render();
}
