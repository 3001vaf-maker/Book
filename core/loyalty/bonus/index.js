import {
  checkList,
  collectCheckList,
  datePicker,
  details,
  emptyState,
  entityCardStack,
  field,
  formValidationMessage,
  initCheckList,
  initDatePickers,
  miniCard,
  miniCardRail,
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
  twoColumnLayout,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
} from '../../../ui/ui.js';
import { getProcedures } from '../../service/procedures/data.js';
import {
  bindViewSettings,
  formObject,
  initLoyaltyTermFields,
  loyaltyCardFields,
  loyaltyHeader,
  loyaltyTermData,
  loyaltyTermFields,
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
    termType: 'indefinite',
    termStartDate: '',
    termEndDate: '',
    assignment: 'all',
    condition: 'each-paid',
    conditionValue: '',
    conditionServiceIds: [],
    rewardType: 'percent',
    rewardValue: 5,
    rewardBase: 'Сумма оплаченной операции',
    rewardPositionRules: [],
    rewardTiers: [],
    rewardExpiryType: 'duration',
    rewardExpiryCount: 90,
    rewardExpiryUnit: 'days',
    rewardExpiryValue: '90 дн.',
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
    term: 'Бессрочно',
    termType: 'indefinite',
    termStartDate: '',
    termEndDate: '',
    assignment: 'selected',
    condition: 'minimum-amount',
    conditionValue: '5000',
    conditionServiceIds: [],
    rewardType: 'percent',
    rewardValue: 10,
    rewardBase: 'Сумма оплаченной операции',
    rewardPositionRules: [],
    rewardTiers: [],
    rewardExpiryType: 'indefinite',
    rewardExpiryCount: 0,
    rewardExpiryUnit: 'days',
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

function periodLabel(count = 0, unit = 'days') {
  const amount = Math.max(1, Number(count || 1));
  return `${amount} ${unit === 'months' ? 'мес.' : unit === 'years' ? 'лет' : 'дн.'}`;
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
  if (program.rewardType === 'fixed') return `${value} бонусов`;
  if (program.rewardType === 'tiered') return 'Ступенчатое начисление';
  if (program.rewardType === 'per-position') return 'По позициям Сервиса';
  return `${value}% бонусами`;
}

function expiryLabel(program = {}) {
  return program.rewardExpiryType === 'duration'
    ? (program.rewardExpiryValue || periodLabel(program.rewardExpiryCount, program.rewardExpiryUnit))
    : 'Бессрочно';
}

function timingLabel(value = '') {
  if (value === 'completion') return 'После завершения';
  if (value === 'payment') return 'После оплаты';
  return 'После завершения и оплаты';
}

function recurrenceLabel(program = {}) {
  if (program.recurrence === 'once') return 'Один раз';
  if (program.recurrence === 'first-n') return `Первые ${program.recurrenceValue || 'N'} раз`;
  if (program.recurrence === 'limited-period') return `Не чаще ${program.recurrenceValue || 'N за период'}`;
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

function programConditions(program = {}) {
  return [
    `Срок программы: ${program.term || 'Бессрочно'}`,
    `Кому действует: ${assignmentLabel(program.assignment)}`,
    `Условие начисления: ${conditionLabel(program.condition)}`,
    `Параметр условия: ${program.conditionValue || '—'}`,
    `Размер начисления: ${rewardLabel(program)}`,
    `База: ${program.rewardBase || '—'}`,
    `Срок жизни награды: ${expiryLabel(program)}`,
    `Повторяемость: ${recurrenceLabel(program)}`,
    `Момент начисления: ${timingLabel(program.timing)}`,
    `Состояние: ${program.status === 'active' ? 'Активна' : 'Неактивна'}`,
    '',
    program.description || 'Дополнительные условия не указаны.',
  ].join('\n');
}

function participantInfo(participant = {}, program = {}) {
  return details([
    { label: 'Контакт', value: participant.personName || '—' },
    { label: 'Программа', value: program.name || '—' },
    { label: 'Дата назначения', value: shortDateTime(participant.assignedAt, '—') },
    { label: 'Состояние', value: participant.assignmentStatus === 'active' ? 'Активна' : 'Отключена' },
    { label: 'Квалифицирующих событий', value: String(Math.max(0, Number(participant.qualifiedEvents || 0))) },
    { label: 'Начислено', value: `${Math.max(0, Number(participant.earned || 0))} бонусов` },
    { label: 'Использовано', value: `${Math.max(0, Number(participant.spent || 0))} бонусов` },
    { label: 'Доступно', value: `${Math.max(0, Number(participant.available || 0))} бонусов` },
    { label: 'Срок текущей награды', value: participant.rewardExpiry || expiryLabel(program) },
  ]);
}

function historyMarkup(participant = {}) {
  const history = Array.isArray(participant.history) ? participant.history : [];
  if (!history.length) return emptyState('Истории пока нет', 'Начисления, списания и корректировки появятся здесь.');
  return miniCardRail([...history].reverse().map((item) => miniCard({
    title: item.title || 'Операция программы',
    value: `${Number(item.amount || 0) >= 0 ? '+' : '−'}${Math.abs(Number(item.amount || 0))} бонусов`,
    subtitle: shortDateTime(item.occurredAt, '—'),
    rows: [{ label: 'Источник', value: item.source || '—' }],
  })));
}

function participantList(items = []) {
  if (!items.length) return emptyState('Участников пока нет', 'Контакты появятся здесь после назначения программы.');
  return v2ListEntries(items.map((participant) => v2ListEntry({
    title: participant.personName || 'Без имени',
    subtitle: participant.assignmentStatus === 'active' ? 'Активна' : 'Отключена',
    rightTop: `${Math.max(0, Number(participant.available || 0))} бонусов`,
    rightBottom: `Начислено ${Math.max(0, Number(participant.earned || 0))}`,
    interactive: true,
    initial: '',
    data: `data-bonus-participant="${participant.id}"`,
    aria: `Открыть результат программы ${participant.personName || ''}`,
  })));
}

function openConditions(program = {}) {
  return openDocumentViewer({
    title: program.name || 'Условия бонусной программы',
    content: programConditions(program),
  });
}

function services() {
  return getProcedures()
    .map((item) => ({ value: String(item.id || ''), label: item.name || 'Позиция Сервиса' }))
    .filter((item) => item.value);
}

function serviceName(id = '') {
  return services().find((item) => item.value === String(id || ''))?.label || '';
}

function tierFields(index) {
  return `<div data-bonus-tier="${index}">${twoColumnLayout(
    field({ label: `Ступень ${index} — от суммы`, name: `tier${index}Threshold`, type: 'number', min: '0', step: '0.01', inputmode: 'decimal' }),
    field({ label: `Ступень ${index} — %`, name: `tier${index}Value`, type: 'number', min: '0', step: '0.01', inputmode: 'decimal' }),
    { ariaLabel: `Ступень ${index}` },
  )}</div>`;
}

function positionRewardFields(ids = []) {
  return ids.map((id) => `<div data-bonus-position-rule="${id}">
    ${select({ label: serviceName(id) || 'Позиция', name: `position_${id}_type`, value: 'percent', options: [{ value: 'fixed', label: 'Фиксированные бонусы' }, { value: 'percent', label: 'Процент' }] })}
    ${field({ label: 'Значение', name: `position_${id}_value`, type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
  </div>`).join('');
}

function initBonusConstructor(layer) {
  const form = layer?.querySelector?.('[data-bonus-form]');
  if (!form) return;
  initLoyaltyTermFields(form);
  initDatePickers(form);
  initCheckList(form);
  const condition = form.querySelector('[name="condition"]');
  const rewardType = form.querySelector('[name="rewardType"]');
  const expiry = form.querySelector('[name="rewardExpiryType"]');
  const recurrence = form.querySelector('[name="recurrence"]');
  const tierCount = form.querySelector('[name="tierCount"]');
  const tierHost = form.querySelector('[data-bonus-tiers]');
  const positionList = form.querySelector('[data-bonus-reward-position-list]');
  const positionHost = form.querySelector('[data-bonus-position-rules]');

  const showPanel = (attribute, value) => {
    form.querySelectorAll(`[${attribute}]`).forEach((panel) => {
      panel.hidden = panel.getAttribute(attribute) !== value;
    });
  };
  const syncCondition = () => showPanel('data-bonus-condition-panel', condition?.value || 'each-paid');
  const syncReward = () => showPanel('data-bonus-reward-panel', rewardType?.value || 'percent');
  const syncExpiry = () => {
    const node = form.querySelector('[data-bonus-expiry-duration]');
    if (node) node.hidden = expiry?.value !== 'duration';
  };
  const syncRecurrence = () => showPanel('data-bonus-recurrence-panel', recurrence?.value || 'each');
  const renderTiers = () => {
    const count = Math.max(1, Math.floor(Number(tierCount?.value || 1)));
    if (tierCount) tierCount.value = String(count);
    if (tierHost) tierHost.innerHTML = Array.from({ length: count }, (_, index) => tierFields(index + 1)).join('');
  };
  const renderPositionRules = () => {
    if (!positionHost || !positionList) return;
    const ids = collectCheckList(positionList);
    positionHost.innerHTML = positionRewardFields(ids);
  };

  condition?.addEventListener('change', syncCondition);
  rewardType?.addEventListener('change', syncReward);
  expiry?.addEventListener('change', syncExpiry);
  recurrence?.addEventListener('change', syncRecurrence);
  tierCount?.addEventListener('input', renderTiers);
  positionList?.addEventListener('change', renderPositionRules);
  syncCondition();
  syncReward();
  syncExpiry();
  syncRecurrence();
  renderTiers();
  renderPositionRules();
}

async function openCreateProgramQ(root, rerender) {
  const serviceItems = services();
  const conditionServiceList = serviceItems.length
    ? checkList(serviceItems, { className: 'bonus-condition-service-list' })
    : emptyState('Позиции Сервиса пока не созданы', 'Сначала добавьте позиции в Сервис.');
  const rewardServiceList = serviceItems.length
    ? checkList(serviceItems, { className: 'bonus-reward-service-list' })
    : emptyState('Позиции Сервиса пока не созданы', 'Сначала добавьте позиции в Сервис.');
  const layer = mountModal(root, modal(`${loyaltyHeader('Новая бонусная программа', {
    c: { label: 'Сохранить', data: 'data-bonus-save', aria: 'Сохранить бонусную программу' },
  })}
    <form class="form-grid" data-bonus-form>
      ${field({ label: 'Название', name: 'name', required: true })}
      ${textareaField({ label: 'Описание / условия', name: 'description' })}
      ${loyaltyTermFields({ prefix: 'bonusTerm', label: 'Срок программы', mode: 'indefinite', allowDuration: false, allowRange: true })}
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
      <div data-bonus-condition-panel="every-n" hidden>${field({ label: 'Каждая N-я операция', name: 'conditionCount', type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '2' })}</div>
      <div data-bonus-condition-panel="after-n" hidden>${field({ label: 'После N операций', name: 'conditionCountAfter', type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '5' })}</div>
      <div data-bonus-condition-panel="minimum-amount" hidden>${field({ label: 'Минимальная сумма', name: 'conditionAmount', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}</div>
      <div data-bonus-condition-panel="cumulative-amount" hidden>${field({ label: 'Накопленная сумма', name: 'conditionCumulative', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}</div>
      <div data-bonus-condition-panel="service-items" hidden>${conditionServiceList}</div>
      <div data-bonus-condition-panel="period" hidden>${twoColumnLayout(
        datePicker({ label: 'С', name: 'conditionStartDate', showYear: true, modalVariant: 'bottom', modalSurface: 'app', allowClear: false }),
        datePicker({ label: 'До', name: 'conditionEndDate', showYear: true, modalVariant: 'bottom', modalSurface: 'app', allowClear: false }),
        { ariaLabel: 'Период условия' },
      )}</div>
      ${select({ label: 'Размер начисления', name: 'rewardType', value: 'percent', options: [
        { value: 'fixed', label: 'Фиксированное количество бонусов' },
        { value: 'percent', label: 'Процент от денежной базы' },
        { value: 'per-position', label: 'Отдельно по позициям Сервиса' },
        { value: 'tiered', label: 'Ступенчатое правило' },
      ] })}
      <div data-bonus-reward-panel="fixed" hidden>${field({ label: 'Бонусов', name: 'rewardFixedValue', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}</div>
      <div data-bonus-reward-panel="percent">${twoColumnLayout(
        field({ label: 'Процент', name: 'rewardPercentValue', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: '5' }),
        select({ label: 'База', name: 'rewardBase', value: 'operation', options: [
          { value: 'operation', label: 'Сумма оплаченной операции' },
          { value: 'items', label: 'Сумма выбранных позиций' },
        ] }),
        { ariaLabel: 'Процентное начисление' },
      )}</div>
      <div data-bonus-reward-panel="per-position" hidden>
        <div data-bonus-reward-position-list>${rewardServiceList}</div>
        <div data-bonus-position-rules></div>
      </div>
      <div data-bonus-reward-panel="tiered" hidden>
        ${field({ label: 'Количество ступеней', name: 'tierCount', type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '3' })}
        <div data-bonus-tiers></div>
      </div>
      ${select({ label: 'Срок жизни награды', name: 'rewardExpiryType', value: 'indefinite', options: [
        { value: 'indefinite', label: 'Бессрочно' },
        { value: 'duration', label: 'N дней / месяцев после начисления' },
      ] })}
      <div data-bonus-expiry-duration hidden>${twoColumnLayout(
        field({ label: 'Количество', name: 'rewardExpiryCount', type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '90' }),
        select({ label: 'Период', name: 'rewardExpiryUnit', value: 'days', options: [
          { value: 'days', label: 'Дней' },
          { value: 'months', label: 'Месяцев' },
        ] }),
        { ariaLabel: 'Срок жизни награды' },
      )}</div>
      ${select({ label: 'Повторяемость', name: 'recurrence', value: 'each', options: [
        { value: 'once', label: 'Один раз' },
        { value: 'each', label: 'Каждый раз' },
        { value: 'first-n', label: 'Первые N раз' },
        { value: 'limited-period', label: 'Не чаще N раз за день / неделю / месяц' },
      ] })}
      <div data-bonus-recurrence-panel="first-n" hidden>${field({ label: 'Количество начислений', name: 'recurrenceCount', type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '1' })}</div>
      <div data-bonus-recurrence-panel="limited-period" hidden>${twoColumnLayout(
        field({ label: 'Не чаще N раз', name: 'recurrenceLimit', type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '1' }),
        select({ label: 'За период', name: 'recurrencePeriod', value: 'day', options: [
          { value: 'day', label: 'День' },
          { value: 'week', label: 'Неделю' },
          { value: 'month', label: 'Месяц' },
        ] }),
        { ariaLabel: 'Ограничение повторяемости' },
      )}</div>
      ${select({ label: 'Момент начисления', name: 'timing', value: 'paid-and-completed', options: [
        { value: 'completion', label: 'После завершения' },
        { value: 'payment', label: 'После оплаты' },
        { value: 'paid-and-completed', label: 'После завершения и оплаты' },
      ] })}
      <div class="form-error" data-bonus-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Новая бонусная программа' }));
  if (!layer) return null;
  initBonusConstructor(layer);
  const form = layer.querySelector('[data-bonus-form]');
  layer.querySelector('[data-bonus-save]')?.addEventListener('click', async () => {
    const error = layer.querySelector('[data-bonus-error]');
    const validation = formValidationMessage(form);
    if (validation) {
      if (error) error.textContent = validation;
      return;
    }
    const values = formObject(form);
    const term = loyaltyTermData(values, 'bonusTerm');
    if (term.type === 'range' && (!term.startDate || !term.endDate)) {
      if (error) error.textContent = 'Укажите дату начала и окончания программы';
      return;
    }
    if (term.type === 'range' && term.startDate > term.endDate) {
      if (error) error.textContent = 'Дата начала не может быть позже даты окончания';
      return;
    }

    const condition = values.condition || 'each-paid';
    const conditionServiceIds = collectCheckList(form, '[data-bonus-condition-panel="service-items"] .ui-check-list input[type="checkbox"]');
    let conditionValue = '';
    if (condition === 'every-n') conditionValue = String(Math.max(1, Number(values.conditionCount || 1)));
    if (condition === 'after-n') conditionValue = String(Math.max(1, Number(values.conditionCountAfter || 1)));
    if (condition === 'minimum-amount') conditionValue = String(Math.max(0, Number(values.conditionAmount || 0)));
    if (condition === 'cumulative-amount') conditionValue = String(Math.max(0, Number(values.conditionCumulative || 0)));
    if (condition === 'service-items') {
      if (!conditionServiceIds.length) {
        if (error) error.textContent = 'Выберите позиции Сервиса';
        return;
      }
      conditionValue = conditionServiceIds.map(serviceName).filter(Boolean).join(' · ');
    }
    if (condition === 'period') {
      if (!values.conditionStartDate || !values.conditionEndDate) {
        if (error) error.textContent = 'Укажите начало и конец периода';
        return;
      }
      if (values.conditionStartDate > values.conditionEndDate) {
        if (error) error.textContent = 'Дата начала не может быть позже даты окончания';
        return;
      }
      conditionValue = `${values.conditionStartDate} — ${values.conditionEndDate}`;
    }

    const rewardType = values.rewardType || 'percent';
    let rewardValue = 0;
    let rewardBase = 'Сумма оплаченной операции';
    let rewardPositionRules = [];
    let rewardTiers = [];
    if (rewardType === 'fixed') rewardValue = Math.max(0, Number(values.rewardFixedValue || 0));
    if (rewardType === 'percent') {
      rewardValue = Math.max(0, Number(values.rewardPercentValue || 0));
      rewardBase = values.rewardBase === 'items' ? 'Сумма выбранных позиций' : 'Сумма оплаченной операции';
    }
    if (rewardType === 'per-position') {
      const ids = collectCheckList(form, '[data-bonus-reward-position-list] .ui-check-list input[type="checkbox"]');
      if (!ids.length) {
        if (error) error.textContent = 'Выберите позиции Сервиса для начисления';
        return;
      }
      rewardPositionRules = ids.map((id) => ({
        serviceId: id,
        serviceName: serviceName(id),
        type: values[`position_${id}_type`] || 'percent',
        value: Math.max(0, Number(values[`position_${id}_value`] || 0)),
      }));
    }
    if (rewardType === 'tiered') {
      const count = Math.max(1, Math.floor(Number(values.tierCount || 1)));
      rewardTiers = Array.from({ length: count }, (_, index) => ({
        threshold: Math.max(0, Number(values[`tier${index + 1}Threshold`] || 0)),
        value: Math.max(0, Number(values[`tier${index + 1}Value`] || 0)),
      }));
    }

    const rewardExpiryType = values.rewardExpiryType || 'indefinite';
    const rewardExpiryCount = rewardExpiryType === 'duration' ? Math.max(1, Number(values.rewardExpiryCount || 1)) : 0;
    const rewardExpiryUnit = values.rewardExpiryUnit || 'days';
    const recurrence = values.recurrence || 'each';
    let recurrenceValue = '';
    if (recurrence === 'first-n') recurrenceValue = String(Math.max(1, Number(values.recurrenceCount || 1)));
    if (recurrence === 'limited-period') {
      const period = values.recurrencePeriod === 'week' ? 'неделю' : values.recurrencePeriod === 'month' ? 'месяц' : 'день';
      recurrenceValue = `${Math.max(1, Number(values.recurrenceLimit || 1))} за ${period}`;
    }

    programs.push({
      id: uid('bonus-program'),
      name: values.name,
      description: values.description || '',
      term: term.label,
      termType: term.type,
      termStartDate: term.startDate,
      termEndDate: term.endDate,
      assignment: values.assignment || 'all',
      condition,
      conditionValue,
      conditionServiceIds,
      rewardType,
      rewardValue,
      rewardBase,
      rewardPositionRules,
      rewardTiers,
      rewardExpiryType,
      rewardExpiryCount,
      rewardExpiryUnit,
      rewardExpiryValue: rewardExpiryType === 'duration' ? periodLabel(rewardExpiryCount, rewardExpiryUnit) : '',
      recurrence,
      recurrenceValue,
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

async function openParticipantLayer(root, participantId) {
  const participant = participants.find((item) => item.id === participantId);
  if (!participant) return null;
  const program = programs.find((item) => item.id === participant.programId) || {};
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-bonus-participant-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(participant.personName || 'Участник программы'),
    participantInfo(participant, program),
    v2Section('История', historyMarkup(participant)),
  ]);
  notifyLoyaltyContext();
  return layer;
}

async function openProgramLayer(root, programId) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-bonus-program-z' }), { stack: true });
  if (!layer) return null;
  const program = programs.find((item) => item.id === programId);
  if (!program) {
    layer.v2Close?.();
    return null;
  }
  const items = participants.filter((item) => item.programId === program.id);
  layer.innerHTML = page([
    loyaltyHeader(program.name || 'Бонусная программа'),
    v2Section('Участники', participantList(items)),
  ]);
  setV2ZHeaderRows(layer, [smallActionButton({ icon: 'info', data: 'data-bonus-info', aria: 'Условия бонусной программы' })]);
  layer.querySelector('[data-bonus-info]')?.addEventListener('click', () => openConditions(program));
  layer.querySelectorAll('[data-bonus-participant]').forEach((node) => node.addEventListener('click', () => openParticipantLayer(root, text(node.dataset.bonusParticipant))));
  notifyLoyaltyContext();
  return layer;
}

export async function renderBonus(root) {
  const render = async () => {
    const cards = programs.length
      ? entityCardStack(programs.map((program) => loyaltyVisualCard('bonus', programCardFields(program), {
          data: `data-bonus-program="${program.id}"`,
          aria: `Открыть ${program.name}`,
        })))
      : emptyState('Бонусных программ пока нет', 'Создайте первую программу кнопкой «+».');

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
