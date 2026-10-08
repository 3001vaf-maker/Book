import {
  details,
  emptyState,
  entityCardStack,
  field,
  formValidationMessage,
  modal,
  mountModal,
  mountV2ZLayer,
  openDocumentViewer,
  page,
  select,
  setV2ZHeaderRows,
  shortDateTime,
  smallActionButton,
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
    id: 'referral-friend',
    name: 'Приведи друга',
    description: 'Награда после первой полной оплаты приглашённого.',
    term: 'Бессрочно',
    qualifyingEvent: 'first-paid',
    eventValue: '',
    levels: 1,
    levelRewards: [{ type: 'percent', value: 5, base: 'Сумма оплаченной операции' }],
    capType: 'per-invitee',
    capValue: 5000,
    rewardExpiryType: 'duration',
    rewardExpiryValue: '90 дней',
    inviteeBenefit: 'fixed-bonus',
    inviteeBenefitValue: 500,
    rewardTiming: 'paid-and-completed',
    recurrence: 'first',
    recurrenceValue: '',
    assignment: 'all',
    status: 'active',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'referral-vip',
    name: 'VIP рекомендации',
    description: 'Два уровня награды за оплаченные операции.',
    term: '12 месяцев',
    qualifyingEvent: 'each-paid',
    eventValue: '',
    levels: 2,
    levelRewards: [
      { type: 'percent', value: 5, base: 'Сумма оплаченной операции' },
      { type: 'percent', value: 2, base: 'Сумма оплаченной операции' },
    ],
    capType: 'period',
    capValue: 10000,
    rewardExpiryType: 'indefinite',
    rewardExpiryValue: '',
    inviteeBenefit: 'none',
    inviteeBenefitValue: 0,
    rewardTiming: 'payment',
    recurrence: 'each',
    recurrenceValue: '',
    assignment: 'selected',
    status: 'active',
    createdAt: '2026-10-02T10:00:00.000Z',
  },
];

let relations = [
  {
    id: 'referral-relation-1', programId: 'referral-friend', inviterName: 'Иван Петров', inviteeName: 'Анна Иванова', inviterCode: 'IVAN-REF',
    createdAt: '2026-10-02T11:00:00.000Z', level: 1, status: 'completed', qualifyingEvent: 'Первая оплаченная операция',
    resultBase: 10000, reward: 500, rewardAvailable: 300, rewardExpiresAt: '2027-01-02',
  },
  {
    id: 'referral-relation-2', programId: 'referral-friend', inviterName: 'Анна Иванова', inviteeName: 'Мария Смирнова', inviterCode: 'ANNA-REF',
    createdAt: '2026-10-05T11:00:00.000Z', level: 1, status: 'waiting', qualifyingEvent: 'Ожидается первая оплаченная операция',
    resultBase: 0, reward: 0, rewardAvailable: 0, rewardExpiresAt: '',
  },
];

function eventLabel(value = '') {
  if (value === 'each-paid') return 'Каждая оплаченная операция';
  if (value === 'first-n-paid') return 'Первые N оплаченных операций';
  if (value === 'minimum-amount') return 'Операция не меньше заданной суммы';
  if (value === 'service-items') return 'Выбранные позиции Сервиса';
  if (value === 'paid-supported-event') return 'Оплаченный Заказ / Продажа / поддерживаемое событие';
  if (value === 'within-referral-period') return 'Действие в срок после реферальной связи';
  return 'Первая оплаченная операция';
}

function rewardTypeLabel(value = '') { return value === 'fixed' ? 'Фиксированные бонусы' : 'Процент от базы'; }
function assignmentLabel(value = '') { return value === 'selected' ? 'Выбранным контактам' : 'Всем контактам'; }
function relationStatus(value = '') { if (value === 'completed') return 'Выполнено'; if (value === 'cancelled') return 'Отменено'; return 'Ожидает результата'; }

function capLabel(program = {}) {
  const value = Math.max(0, Number(program.capValue || 0));
  if (program.capType === 'none') return 'Без ограничения';
  if (program.capType === 'per-operation') return `До ${value} за операцию`;
  if (program.capType === 'period') return `До ${value} за период`;
  return `До ${value} от одного приглашённого`;
}

function timingLabel(value = '') {
  if (value === 'completion') return 'После завершения';
  if (value === 'payment') return 'После полной оплаты';
  return 'После завершения и полной оплаты';
}

function recurrenceLabel(program = {}) {
  if (program.recurrence === 'each') return 'Каждое успешное действие';
  if (program.recurrence === 'first-n') return `Первые ${program.recurrenceValue || 'N'} успешных действий`;
  if (program.recurrence === 'period') return `Действия в течение ${program.recurrenceValue || 'N дней / месяцев'}`;
  if (program.recurrence === 'until-cap') return `До общего лимита ${program.recurrenceValue || '—'}`;
  return 'Только первое успешное действие';
}

function inviteeBenefitLabel(program = {}) {
  const amount = Math.max(0, Number(program.inviteeBenefitValue || 0));
  if (program.inviteeBenefit === 'fixed-bonus') return `${amount} бонусов внутри программы`;
  if (program.inviteeBenefit === 'percent-bonus') return `${amount}% бонусами внутри программы`;
  if (program.inviteeBenefit === 'discount') return `Скидка ${amount}% на квалифицирующее действие`;
  return 'Без отдельной выгоды';
}

function rewardExpiryLabel(program = {}) { return program.rewardExpiryType === 'duration' ? (program.rewardExpiryValue || 'N дней / месяцев') : 'Бессрочно'; }

function levelSummary(program = {}) {
  return (Array.isArray(program.levelRewards) ? program.levelRewards : [])
    .slice(0, Math.max(1, Number(program.levels || 1)))
    .map((reward, index) => `Уровень ${index + 1}: ${rewardTypeLabel(reward.type)} ${reward.value || 0}${reward.type === 'percent' ? '%' : ''}`)
    .join(' · ');
}

function programCardFields(program = {}) {
  return loyaltyCardFields({
    title: program.name || 'Реферальная программа',
    subtitle: eventLabel(program.qualifyingEvent),
    status: program.status === 'active' ? 'Активна' : 'Неактивна',
    metaLeft: assignmentLabel(program.assignment),
    metaRight: `${program.levels || 1} ур.`,
  });
}

function programConditions(program = {}) {
  return [
    `Срок программы: ${program.term || 'Бессрочно'}`,
    `Результативное событие: ${eventLabel(program.qualifyingEvent)}`,
    `Параметр события: ${program.eventValue || '—'}`,
    `Уровни: ${levelSummary(program)}`,
    `Ограничение награды: ${capLabel(program)}`,
    `Срок награды: ${rewardExpiryLabel(program)}`,
    `Выгода приглашённому: ${inviteeBenefitLabel(program)}`,
    `Момент начисления: ${timingLabel(program.rewardTiming)}`,
    `Повторяемость: ${recurrenceLabel(program)}`,
    `Доступность: ${assignmentLabel(program.assignment)}`,
    `Состояние: ${program.status === 'active' ? 'Активна' : 'Неактивна'}`,
    '',
    program.description || 'Дополнительные условия не указаны.',
  ].join('\n');
}

function relationInfo(relation = {}, program = {}) {
  return details([
    { label: 'Пригласил', value: relation.inviterName || '—' },
    { label: 'Приглашён', value: relation.inviteeName || '—' },
    { label: 'Дата связи', value: shortDateTime(relation.createdAt, '—') },
    { label: 'Программа', value: program.name || '—' },
    { label: 'Уровень', value: String(relation.level || 1) },
    { label: 'Состояние', value: relationStatus(relation.status) },
    { label: 'Реферальный код', value: relation.inviterCode || '—' },
    { label: 'Квалифицирующее событие', value: relation.qualifyingEvent || '—' },
    { label: 'База результата', value: relation.resultBase ? String(relation.resultBase) : '—' },
    { label: 'Начислено', value: `${Math.max(0, Number(relation.reward || 0))} бонусов` },
    { label: 'Доступно', value: `${Math.max(0, Number(relation.rewardAvailable || 0))} бонусов` },
    { label: 'Срок награды', value: relation.rewardExpiresAt || rewardExpiryLabel(program) },
  ]);
}

function relationList(items = []) {
  if (!items.length) return emptyState('Связей пока нет', 'Реферальные связи появятся после использования программы.');
  return v2ListEntries(items.map((relation) => v2ListEntry({
    title: `${relation.inviterName || '—'} → ${relation.inviteeName || '—'}`,
    subtitle: relation.qualifyingEvent || 'Реферальная связь',
    rightTop: relationStatus(relation.status),
    rightBottom: relation.reward ? `${relation.reward} бонусов` : '',
    interactive: true,
    initial: '',
    data: `data-referral-relation="${relation.id}"`,
    aria: `Открыть реферальную связь ${relation.inviterName || ''} ${relation.inviteeName || ''}`,
  })));
}

function openConditions(program = {}) {
  return openDocumentViewer({
    title: program.name || 'Условия реферальной программы',
    content: programConditions(program),
  });
}

function levelFields(level) {
  return `
    ${select({ label: `Уровень ${level} — тип награды`, name: `level${level}Type`, value: 'percent', options: [
      { value: 'fixed', label: 'Фиксированное количество бонусов' },
      { value: 'percent', label: 'Процент от базы' },
    ] })}
    ${field({ label: `Уровень ${level} — значение`, name: `level${level}Value`, type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
    ${select({ label: `Уровень ${level} — база процента`, name: `level${level}Base`, value: 'operation', options: [
      { value: 'operation', label: 'Сумма оплаченной операции' },
      { value: 'items', label: 'Сумма выбранных позиций' },
      { value: 'supported', label: 'Другая поддерживаемая база программы' },
    ] })}`;
}

function baseLabel(value = '') {
  if (value === 'items') return 'Сумма выбранных позиций';
  if (value === 'supported') return 'Поддерживаемая база программы';
  return 'Сумма оплаченной операции';
}

async function openCreateProgramQ(root, rerender) {
  const layer = mountModal(root, modal(`${loyaltyHeader('Новая реферальная программа', {
    c: { label: 'Сохранить', data: 'data-referral-save', aria: 'Сохранить реферальную программу' },
  })}
    <form class="form-grid" data-referral-form>
      ${field({ label: 'Название', name: 'name', required: true })}
      ${textareaField({ label: 'Описание / условия', name: 'description' })}
      ${field({ label: 'Срок программы', name: 'term', placeholder: 'Бессрочно или дата — дата' })}
      ${select({ label: 'Результативное событие', name: 'qualifyingEvent', value: 'first-paid', options: [
        { value: 'first-paid', label: 'Первая оплаченная операция приглашённого' },
        { value: 'each-paid', label: 'Каждая оплаченная операция' },
        { value: 'first-n-paid', label: 'Первые N оплаченных операций' },
        { value: 'minimum-amount', label: 'Операция не меньше заданной суммы' },
        { value: 'service-items', label: 'Выбранные позиции Сервиса' },
        { value: 'paid-supported-event', label: 'Оплаченный Заказ / Продажа / другое событие' },
        { value: 'within-referral-period', label: 'Действие в течение срока после связи' },
      ] })}
      ${field({ label: 'N / сумма / срок / выбранные позиции', name: 'eventValue', placeholder: 'Параметр выбранного события' })}
      ${field({ label: 'Количество уровней', name: 'levels', type: 'number', min: '1', max: '3', step: '1', value: '1', inputmode: 'numeric' })}
      ${levelFields(1)}${levelFields(2)}${levelFields(3)}
      ${select({ label: 'Ограничение награды', name: 'capType', value: 'none', options: [
        { value: 'none', label: 'Без ограничения' },
        { value: 'per-operation', label: 'Максимум за одну операцию' },
        { value: 'per-invitee', label: 'Максимум от одного приглашённого' },
        { value: 'period', label: 'Максимум за период' },
      ] })}
      ${field({ label: 'Значение ограничения', name: 'capValue', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
      ${select({ label: 'Срок жизни награды', name: 'rewardExpiryType', value: 'indefinite', options: [
        { value: 'indefinite', label: 'Бессрочно' },
        { value: 'duration', label: 'N дней / месяцев после начисления' },
      ] })}
      ${field({ label: 'Срок награды', name: 'rewardExpiryValue', placeholder: 'Например: 90 дней' })}
      ${select({ label: 'Выгода приглашённому', name: 'inviteeBenefit', value: 'none', options: [
        { value: 'none', label: 'Без отдельной выгоды' },
        { value: 'fixed-bonus', label: 'Фиксированные бонусы внутри программы' },
        { value: 'percent-bonus', label: 'Процент бонусами внутри программы' },
        { value: 'discount', label: 'Скидка на квалифицирующее действие' },
      ] })}
      ${field({ label: 'Размер выгоды приглашённому', name: 'inviteeBenefitValue', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
      ${select({ label: 'Момент начисления', name: 'rewardTiming', value: 'paid-and-completed', options: [
        { value: 'completion', label: 'После завершения события' },
        { value: 'payment', label: 'После полной оплаты' },
        { value: 'paid-and-completed', label: 'После завершения и полной оплаты' },
      ] })}
      ${select({ label: 'Повторяемость', name: 'recurrence', value: 'first', options: [
        { value: 'first', label: 'Только первое успешное действие' },
        { value: 'each', label: 'Каждое успешное действие' },
        { value: 'first-n', label: 'Первые N успешных действий' },
        { value: 'period', label: 'Действия в течение N дней / месяцев' },
        { value: 'until-cap', label: 'До заданного общего лимита начислений' },
      ] })}
      ${field({ label: 'N / период / общий лимит', name: 'recurrenceValue', placeholder: 'Параметр повторяемости' })}
      ${select({ label: 'Кому доступна', name: 'assignment', value: 'all', options: [
        { value: 'all', label: 'Всем контактам' },
        { value: 'selected', label: 'Выбранным контактам' },
      ] })}
      <div class="form-error" data-referral-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Новая реферальная программа' }));
  if (!layer) return null;
  const form = layer.querySelector('[data-referral-form]');
  layer.querySelector('[data-referral-save]')?.addEventListener('click', async () => {
    const error = layer.querySelector('[data-referral-error]');
    const validation = formValidationMessage(form);
    if (validation) { if (error) error.textContent = validation; return; }
    const values = formObject(form);
    const levels = Math.max(1, Math.min(3, Number(values.levels || 1)));
    const levelRewards = [1, 2, 3].slice(0, levels).map((level) => ({
      type: values[`level${level}Type`] || 'percent',
      value: Math.max(0, Number(String(values[`level${level}Value`] || '0').replace(',', '.')) || 0),
      base: baseLabel(values[`level${level}Base`]),
    }));
    programs.push({
      id: uid('referral-program'), name: values.name, description: values.description || '', term: values.term || 'Бессрочно',
      qualifyingEvent: values.qualifyingEvent || 'first-paid', eventValue: values.eventValue || '', levels, levelRewards,
      capType: values.capType || 'none', capValue: Math.max(0, Number(String(values.capValue || '0').replace(',', '.')) || 0),
      rewardExpiryType: values.rewardExpiryType || 'indefinite', rewardExpiryValue: values.rewardExpiryValue || '',
      inviteeBenefit: values.inviteeBenefit || 'none', inviteeBenefitValue: Math.max(0, Number(String(values.inviteeBenefitValue || '0').replace(',', '.')) || 0),
      rewardTiming: values.rewardTiming || 'paid-and-completed', recurrence: values.recurrence || 'first', recurrenceValue: values.recurrenceValue || '',
      assignment: values.assignment || 'all', status: 'active', createdAt: new Date().toISOString(),
    });
    layer.v2Close?.();
    await rerender?.();
  });
  notifyLoyaltyContext();
  return layer;
}

async function openRelationLayer(root, relationId) {
  const relation = relations.find((item) => item.id === relationId);
  if (!relation) return null;
  const program = programs.find((item) => item.id === relation.programId) || {};
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-referral-relation-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(`${relation.inviterName || '—'} → ${relation.inviteeName || '—'}`),
    relationInfo(relation, program),
  ]);
  notifyLoyaltyContext();
  return layer;
}

async function openProgramLayer(root, programId) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-referral-program-z' }), { stack: true });
  if (!layer) return null;
  const program = programs.find((item) => item.id === programId);
  if (!program) { layer.v2Close?.(); return null; }
  const items = relations.filter((item) => item.programId === program.id);
  layer.innerHTML = page([
    loyaltyHeader(program.name || 'Реферальная программа'),
    v2Section('Связи', relationList(items)),
  ]);
  setV2ZHeaderRows(layer, [smallActionButton({ icon: 'info', data: 'data-referral-info', aria: 'Условия реферальной программы' })]);
  layer.querySelector('[data-referral-info]')?.addEventListener('click', () => openConditions(program));
  layer.querySelectorAll('[data-referral-relation]').forEach((node) => node.addEventListener('click', () => openRelationLayer(root, text(node.dataset.referralRelation))));
  notifyLoyaltyContext();
  return layer;
}

export async function renderReferral(root) {
  const render = async () => {
    const cards = programs.length ? entityCardStack(programs.map((program) => loyaltyVisualCard('referral', programCardFields(program), {
      data: `data-referral-program="${program.id}"`,
      aria: `Открыть ${program.name}`,
    }))) : emptyState('Реферальных программ пока нет', 'Создайте первую программу кнопкой «+».');

    root.innerHTML = page([
      loyaltyHeader('Реферальная программа', {
        settings: true,
        c: { label: '+', data: 'data-referral-create', aria: 'Создать реферальную программу' },
      }),
      cards,
    ]);
    bindViewSettings(root, 'Реферальная программа', {
      type: 'referral',
      fields: () => programCardFields(programs[0] || { name: 'Реферальная программа', qualifyingEvent: 'first-paid', assignment: 'all', levels: 1, status: 'active' }),
      onSaved: render,
    });
    root.querySelector('[data-referral-create]')?.addEventListener('click', () => openCreateProgramQ(root, render));
    root.querySelectorAll('[data-referral-program]').forEach((node) => node.addEventListener('click', () => openProgramLayer(root, text(node.dataset.referralProgram))));
    notifyLoyaltyContext();
  };
  await render();
}
