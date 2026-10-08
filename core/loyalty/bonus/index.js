import {
  emptyState,
  entityCardStack,
  field,
  formValidationMessage,
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
import {
  bindViewSettings,
  formObject,
  loyaltyCardFields,
  loyaltyHeader,
  loyaltyVisualCard,
  notifyLoyaltyContext,
  text,
  uid,
} from '../shared.js';

let programs = [
  {
    id: 'bonus-cashback-5',
    name: 'Кэшбэк 5%',
    description: '5% бонусами с каждой оплаченной операции.',
    term: 'Бессрочно',
    assignment: 'all',
    condition: 'each-paid',
    conditionValue: '',
    rewardType: 'percent',
    rewardValue: 5,
    rewardBase: 'Сумма оплаченной операции',
    rewardExpiryType: 'duration',
    rewardExpiryValue: '90 дней',
    recurrence: 'each',
    recurrenceValue: '',
    timing: 'paid-and-completed',
    status: 'active',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'bonus-vip-10',
    name: 'VIP 10%',
    description: '10% бонусами по выбранным условиям.',
    term: '12 месяцев',
    assignment: 'selected',
    condition: 'minimum-amount',
    conditionValue: '5000',
    rewardType: 'percent',
    rewardValue: 10,
    rewardBase: 'Сумма оплаченной операции',
    rewardExpiryType: 'indefinite',
    rewardExpiryValue: '',
    recurrence: 'each',
    recurrenceValue: '',
    timing: 'payment',
    status: 'active',
    createdAt: '2026-10-02T10:00:00.000Z',
  },
];

let participants = [
  {
    id: 'bonus-participant-1',
    programId: 'bonus-cashback-5',
    personName: 'Иван Петров',
    assignedAt: '2026-10-02T12:00:00.000Z',
    assignmentStatus: 'active',
    earned: 4200,
    spent: 1500,
    available: 2700,
    rewardExpiry: '2027-01-05',
    qualifiedEvents: 8,
    history: [
      { title: 'Начисление', amount: 500, source: 'Оплаченная операция', occurredAt: '2026-10-05T12:00:00.000Z' },
      { title: 'Списание', amount: -300, source: 'Расчёт', occurredAt: '2026-10-06T12:00:00.000Z' },
    ],
  },
  {
    id: 'bonus-participant-2',
    programId: 'bonus-cashback-5',
    personName: 'Мария Смирнова',
    assignedAt: '2026-10-04T12:00:00.000Z',
    assignmentStatus: 'active',
    earned: 800,
    spent: 0,
    available: 800,
    rewardExpiry: '2027-01-06',
    qualifiedEvents: 2,
    history: [],
  },
];

function assignmentLabel(value = '') {
  return value === 'selected' ? 'Выбранным контактам' : 'Всем контактам';
}

function conditionLabel(value = '') {
  if (value === 'first-paid') return 'Первая оплаченная операция';
  if (value === 'every-n') return 'Каждая N-я операция';
  if (value === 'after-n') return 'После N операций';
  if (value === 'minimum-amount') return 'Операция не меньше заданной суммы';
  if (value === 'cumulative-amount') return 'Достижение накопленной суммы';
  if (value === 'service-items') return 'Выбранные позиции Сервиса';
  if (value === 'period') return 'Событие в заданный период';
  return 'Каждая оплаченная операция';
}

function rewardLabel(program = {}) {
  const value = Math.max(0, Number(program.rewardValue || 0));
  return program.rewardType === 'fixed' ? `${value} бонусов` : `${value}% бонусами`;
}

function expiryLabel(program = {}) {
  return program.rewardExpiryType === 'duration' ? (program.rewardExpiryValue || 'N дней / месяцев') : 'Бессрочно';
}

function timingLabel(value = '') {
  if (value === 'completion') return 'После завершения';
  if (value === 'payment') return 'После оплаты';
  return 'После завершения и оплаты';
}

function recurrenceLabel(program = {}) {
  if (program.recurrence === 'once') return 'Один раз';
  if (program.recurrence === 'first-n') return `Первые ${program.recurrenceValue || 'N'} раз`;
  if (program.recurrence === 'limited-period') return `Не чаще ${program.recurrenceValue || 'N'} за период`;
  return 'Каждый раз';
}

function programCardFields(program = {}) {
  return loyaltyCardFields({
    title: program.name || 'Бонусная программа',
    subtitle: conditionLabel(program.condition),
    status: program.status === 'active' ? 'Активна' : 'Неактивна',
    metaLeft: assignmentLabel(program.assignment),
    metaRight: rewardLabel(program),
  });
}

function participantCardFields(participant = {}, program = {}) {
  return loyaltyCardFields({
    title: participant.personName || 'Без имени',
    subtitle: program.name || 'Бонусная программа',
    status: participant.assignmentStatus === 'active' ? 'Активна' : 'Отключена',
    metaLeft: `Начислено ${Math.max(0, Number(participant.earned || 0))}`,
    metaRight: `Доступно ${Math.max(0, Number(participant.available || 0))}`,
  });
}

function programInfo(program = {}) {
  return v2ListEntries([
    ['Срок программы', program.term || 'Бессрочно'],
    ['Кому действует', assignmentLabel(program.assignment)],
    ['Условие начисления', conditionLabel(program.condition)],
    ['Параметр условия', program.conditionValue || '—'],
    ['Размер начисления', rewardLabel(program)],
    ['База', program.rewardBase || '—'],
    ['Срок жизни награды', expiryLabel(program)],
    ['Повторяемость', recurrenceLabel(program)],
    ['Момент начисления', timingLabel(program.timing)],
    ['Условия', program.description || '—'],
    ['Состояние', program.status === 'active' ? 'Активна' : 'Неактивна'],
  ].map(([title, subtitle]) => v2ListEntry({ title, subtitle: String(subtitle), interactive: false, initial: '' })));
}

function participantInfo(participant = {}, program = {}) {
  return v2ListEntries([
    ['Человек', participant.personName || '—'],
    ['Программа', program.name || '—'],
    ['Дата назначения', shortDateTime(participant.assignedAt, '—')],
    ['Состояние назначения', participant.assignmentStatus === 'active' ? 'Активна' : 'Отключена'],
    ['Квалифицирующих событий', String(Math.max(0, Number(participant.qualifiedEvents || 0)))],
    ['Начислено', `${Math.max(0, Number(participant.earned || 0))} бонусов`],
    ['Использовано', `${Math.max(0, Number(participant.spent || 0))} бонусов`],
    ['Доступно', `${Math.max(0, Number(participant.available || 0))} бонусов`],
    ['Срок текущей награды', participant.rewardExpiry || expiryLabel(program)],
  ].map(([title, subtitle]) => v2ListEntry({ title, subtitle: String(subtitle), interactive: false, initial: '' })));
}

function historyMarkup(participant = {}) {
  const history = Array.isArray(participant.history) ? participant.history : [];
  if (!history.length) return emptyState('Истории пока нет', 'Начисления, списания и корректировки появятся здесь.');
  return v2ListEntries([...history].reverse().map((item) => v2ListEntry({
    title: item.title || 'Операция программы',
    subtitle: `${item.source || 'Источник'} · ${shortDateTime(item.occurredAt, '—')}`,
    rightTop: `${Number(item.amount || 0) >= 0 ? '+' : '−'}${Math.abs(Number(item.amount || 0))} бонусов`,
    interactive: false,
    initial: '',
  })));
}

async function openCreateProgramQ(root, rerender) {
  const layer = mountModal(root, modal(`${loyaltyHeader('Новая бонусная программа', {
    c: { label: 'Сохранить', data: 'data-bonus-save', aria: 'Сохранить бонусную программу' },
  })}
    <form class="form-grid" data-bonus-form>
      ${field({ label: 'Название', name: 'name', required: true })}
      ${textareaField({ label: 'Описание / условия', name: 'description' })}
      ${field({ label: 'Срок программы', name: 'term', placeholder: 'Бессрочно или дата — дата' })}
      ${select({ label: 'Кому действует', name: 'assignment', value: 'all', options: [
        { value: 'all', label: 'Всем контактам' },
        { value: 'selected', label: 'Выбранным контактам' },
      ] })}
      ${select({ label: 'Условие начисления', name: 'condition', value: 'each-paid', options: [
        { value: 'each-paid', label: 'Каждая оплаченная операция' },
        { value: 'first-paid', label: 'Первая оплаченная операция' },
        { value: 'every-n', label: 'Каждая N-я операция' },
        { value: 'after-n', label: 'После N операций' },
        { value: 'minimum-amount', label: 'Операция не меньше заданной суммы' },
        { value: 'cumulative-amount', label: 'Достижение накопленной суммы' },
        { value: 'service-items', label: 'Выбранные позиции Сервиса' },
        { value: 'period', label: 'Событие в заданный период' },
      ] })}
      ${field({ label: 'N / сумма / позиции / период', name: 'conditionValue', placeholder: 'Параметр условия' })}
      ${select({ label: 'Размер начисления', name: 'rewardType', value: 'percent', options: [
        { value: 'fixed', label: 'Фиксированное количество бонусов' },
        { value: 'percent', label: 'Процент от денежной базы' },
      ] })}
      ${field({ label: 'Значение начисления', name: 'rewardValue', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
      ${field({ label: 'База процента', name: 'rewardBase', value: 'Сумма оплаченной операции' })}
      ${select({ label: 'Срок жизни награды', name: 'rewardExpiryType', value: 'indefinite', options: [
        { value: 'indefinite', label: 'Бессрочно' },
        { value: 'duration', label: 'N дней / месяцев после начисления' },
      ] })}
      ${field({ label: 'Срок награды', name: 'rewardExpiryValue', placeholder: 'Например: 90 дней' })}
      ${select({ label: 'Повторяемость', name: 'recurrence', value: 'each', options: [
        { value: 'once', label: 'Один раз' },
        { value: 'each', label: 'Каждый раз' },
        { value: 'first-n', label: 'Первые N раз' },
        { value: 'limited-period', label: 'Не чаще N раз за день / неделю / месяц' },
      ] })}
      ${field({ label: 'Параметр повторяемости', name: 'recurrenceValue', placeholder: 'N / период' })}
      ${select({ label: 'Момент начисления', name: 'timing', value: 'paid-and-completed', options: [
        { value: 'completion', label: 'После завершения' },
        { value: 'payment', label: 'После оплаты' },
        { value: 'paid-and-completed', label: 'После завершения и оплаты' },
      ] })}
      <div class="form-error" data-bonus-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Новая бонусная программа' }));
  if (!layer) return null;
  const form = layer.querySelector('[data-bonus-form]');
  layer.querySelector('[data-bonus-save]')?.addEventListener('click', async () => {
    const error = layer.querySelector('[data-bonus-error]');
    const validation = formValidationMessage(form);
    if (validation) { if (error) error.textContent = validation; return; }
    const values = formObject(form);
    programs.push({
      id: uid('bonus-program'),
      name: values.name,
      description: values.description || '',
      term: values.term || 'Бессрочно',
      assignment: values.assignment || 'all',
      condition: values.condition || 'each-paid',
      conditionValue: values.conditionValue || '',
      rewardType: values.rewardType || 'percent',
      rewardValue: Math.max(0, Number(String(values.rewardValue || '0').replace(',', '.')) || 0),
      rewardBase: values.rewardBase || 'Сумма оплаченной операции',
      rewardExpiryType: values.rewardExpiryType || 'indefinite',
      rewardExpiryValue: values.rewardExpiryValue || '',
      recurrence: values.recurrence || 'each',
      recurrenceValue: values.recurrenceValue || '',
      timing: values.timing || 'paid-and-completed',
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
  return mountModal(root, modal(programInfo(program), { variant: 's', surface: 'app', title: program.name || 'Условия программы' }));
}

async function openParticipantLayer(root, participantId) {
  const participant = participants.find((item) => item.id === participantId);
  if (!participant) return null;
  const program = programs.find((item) => item.id === participant.programId) || {};
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-bonus-participant-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(participant.personName || 'Участник программы'),
    v2Section('Состояние программы', participantInfo(participant, program)),
    v2Section('История', historyMarkup(participant)),
  ]);
  notifyLoyaltyContext();
  return layer;
}

async function openProgramLayer(root, programId) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-bonus-program-z' }), { stack: true });
  if (!layer) return null;
  const program = programs.find((item) => item.id === programId);
  if (!program) { layer.v2Close?.(); return null; }
  const items = participants.filter((item) => item.programId === program.id);
  layer.innerHTML = page([
    loyaltyHeader(program.name || 'Бонусная программа'),
    v2ListEntries([
      v2ListEntry({ title: 'Условия программы', subtitle: conditionLabel(program.condition), rightTop: '[i]', interactive: true, initial: '', data: 'data-bonus-info', aria: 'Открыть условия программы' }),
    ]),
    v2Section('Участники', items.length ? entityCardStack(items.map((participant) => loyaltyVisualCard('bonus', participantCardFields(participant, program), {
      data: `data-bonus-participant="${participant.id}"`,
      aria: `Открыть результат программы ${participant.personName || ''}`,
    }))) : emptyState('Участников пока нет', 'Назначенные люди и результат программы появятся здесь.')),
  ]);
  layer.querySelector('[data-bonus-info]')?.addEventListener('click', () => openConditionsS(root, program));
  layer.querySelectorAll('[data-bonus-participant]').forEach((node) => node.addEventListener('click', () => openParticipantLayer(root, text(node.dataset.bonusParticipant))));
  notifyLoyaltyContext();
  return layer;
}

export async function renderBonus(root) {
  const render = async () => {
    const cards = programs.length ? entityCardStack(programs.map((program) => loyaltyVisualCard('bonus', programCardFields(program), {
      data: `data-bonus-program="${program.id}"`,
      aria: `Открыть ${program.name}`,
    }))) : emptyState('Бонусных программ пока нет', 'Создайте первую программу кнопкой «+».');

    root.innerHTML = page([
      loyaltyHeader('Бонусная программа', {
        settings: true,
        c: { label: '+', data: 'data-bonus-create', aria: 'Создать бонусную программу' },
      }),
      cards,
    ]);
    bindViewSettings(root, 'Бонусная программа', {
      type: 'bonus',
      fields: () => programCardFields(programs[0] || { name: 'Бонусная программа', condition: 'each-paid', assignment: 'all', rewardType: 'percent', rewardValue: 5, status: 'active' }),
      onSaved: render,
    });
    root.querySelector('[data-bonus-create]')?.addEventListener('click', () => openCreateProgramQ(root, render));
    root.querySelectorAll('[data-bonus-program]').forEach((node) => node.addEventListener('click', () => openProgramLayer(root, text(node.dataset.bonusProgram))));
    notifyLoyaltyContext();
  };
  await render();
}
