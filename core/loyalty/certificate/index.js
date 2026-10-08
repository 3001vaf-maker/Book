import {
  datePicker,
  emptyState,
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
import {
  availablePeople,
  bindViewSettings,
  formObject,
  loyaltyHeader,
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
  { id: 'certificate-10000', name: 'Подарочный 10 000', type: 'amount', amount: 10000, service: '', term: '12 месяцев', partial: true, status: 'active', description: 'Можно использовать частями.', createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'certificate-care', name: 'Уход в подарок', type: 'service', amount: 0, service: 'Уход', term: '6 месяцев', partial: false, status: 'active', description: '', createdAt: '2026-10-02T10:00:00.000Z' },
];

let instances = [
  { id: 'certificate-instance-1', programId: 'certificate-10000', ownerKey: 'mock-person-2', ownerName: 'Анна Иванова', buyerKey: 'mock-person-1', buyerName: 'Иван Петров', initialValue: 10000, balance: 2500, status: 'active', issuedAt: '2026-10-03T12:00:00.000Z', expiresAt: '2027-10-03', history: [{ title: 'Использование', amount: 7500, occurredAt: '2026-10-05T12:00:00.000Z' }] },
];

function typeLabel(type) {
  if (type === 'service') return 'На позицию Сервиса';
  if (type === 'bundle') return 'На набор позиций';
  return 'На сумму';
}

function programRight(program = {}) {
  if (program.type === 'amount') return money(program.amount);
  return program.service || typeLabel(program.type);
}

function instanceRight(instance = {}) {
  const program = programs.find((item) => item.id === instance.programId);
  if (program?.type === 'amount') return `${money(instance.balance)} осталось`;
  return instance.status === 'used' ? 'Использован' : 'Активен';
}

function programInfo(program = {}) {
  return v2ListEntries([
    ['Тип', typeLabel(program.type)],
    ['Номинал / право', programRight(program)],
    ['Срок', program.term || 'Бессрочно'],
    ['Частичное использование', program.partial ? 'Разрешено' : 'Нет'],
    ['Условия', program.description || '—'],
    ['Состояние', program.status === 'active' ? 'Активен' : 'Закрыт'],
    ['Создан', shortDateTime(program.createdAt, '—')],
  ].map(([title, subtitle]) => v2ListEntry({ title, subtitle: String(subtitle), interactive: false, initial: '' })));
}

function instanceInfo(instance = {}) {
  const program = programs.find((item) => item.id === instance.programId) || {};
  return v2ListEntries([
    ['Владелец', instance.ownerName || '—'],
    ['Покупатель', instance.buyerName || '—'],
    ['Вид сертификата', program.name || '—'],
    ['Исходное право', program.type === 'amount' ? money(instance.initialValue) : programRight(program)],
    ['Остаток', program.type === 'amount' ? money(instance.balance) : instanceRight(instance)],
    ['Дата оформления', shortDateTime(instance.issuedAt, '—')],
    ['Срок', instance.expiresAt || program.term || 'Бессрочно'],
    ['Состояние', instance.status === 'used' ? 'Использован' : 'Активен'],
  ].map(([title, subtitle]) => v2ListEntry({ title, subtitle: String(subtitle), interactive: false, initial: '' })));
}

function historyMarkup(instance = {}) {
  const history = Array.isArray(instance.history) ? instance.history : [];
  if (!history.length) return emptyState('Использований пока нет', 'История появится после использования сертификата.');
  return v2ListEntries(history.map((item) => v2ListEntry({
    title: item.title || 'Использование',
    subtitle: shortDateTime(item.occurredAt, '—'),
    rightTop: item.amount ? `−${money(item.amount)}` : '',
    interactive: false,
    initial: '',
  })));
}

async function openCreateProgramQ(root, rerender) {
  const layer = mountModal(root, modal(`${loyaltyHeader('Новый сертификат', {
    c: { label: 'Сохранить', data: 'data-certificate-save', aria: 'Сохранить вид сертификата' },
  })}
    <form class="form-grid" data-certificate-form>
      ${field({ label: 'Название', name: 'name', required: true })}
      ${select({ label: 'Тип', name: 'type', value: 'amount', options: [
        { value: 'amount', label: 'На сумму' },
        { value: 'service', label: 'На позицию Сервиса' },
        { value: 'bundle', label: 'На набор позиций' },
      ] })}
      ${field({ label: 'Сумма', name: 'amount', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' })}
      ${field({ label: 'Позиция / набор Сервиса', name: 'service', placeholder: 'Выбор из Сервиса подключается без изменения UI' })}
      ${field({ label: 'Срок', name: 'term', placeholder: 'Например: 12 месяцев или бессрочно' })}
      ${select({ label: 'Частичное использование', name: 'partial', value: 'yes', options: [{ value: 'yes', label: 'Разрешено' }, { value: 'no', label: 'Нет' }] })}
      ${textareaField({ label: 'Условия', name: 'description' })}
      <div class="form-error" data-certificate-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Новый сертификат' }));
  if (!layer) return null;
  const form = layer.querySelector('[data-certificate-form]');
  layer.querySelector('[data-certificate-save]')?.addEventListener('click', async () => {
    const error = layer.querySelector('[data-certificate-error]');
    const validation = formValidationMessage(form);
    if (validation) { if (error) error.textContent = validation; return; }
    const values = formObject(form);
    programs.push({
      id: uid('certificate-program'),
      name: values.name,
      type: values.type || 'amount',
      amount: Math.max(0, Number(String(values.amount || '0').replace(',', '.')) || 0),
      service: values.service || '',
      term: values.term || 'Бессрочно',
      partial: values.partial !== 'no',
      description: values.description || '',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    layer.v2Close?.();
    await rerender?.();
  });
  notifyLoyaltyContext();
  return layer;
}

async function openIssueQ(root, program, rerender) {
  const people = availablePeople(fallbackPeople);
  const options = [{ value: '', label: 'Выберите человека' }, ...people.map(personOption).filter((item) => item.value)];
  const layer = mountModal(root, modal(`${loyaltyHeader('Оформить сертификат', {
    c: { label: 'Оформить', data: 'data-certificate-issue-save', aria: 'Оформить сертификат' },
  })}
    <form class="form-grid" data-certificate-issue-form>
      ${select({ label: 'Покупатель', name: 'buyerKey', value: '', options })}
      ${select({ label: 'Владелец / получатель', name: 'ownerKey', value: '', options })}
      ${program.type === 'amount' ? field({ label: 'Номинал', name: 'amount', type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: program.amount || '' }) : field({ label: 'Право', name: 'right', value: programRight(program), disabled: true })}
      ${datePicker({ label: 'Дата оформления', name: 'issuedAt', value: new Date().toISOString().slice(0, 10), showYear: true, modalVariant: 'bottom', modalSurface: 'app', allowClear: false })}
      ${field({ label: 'Срок / дата окончания', name: 'expiresAt', placeholder: program.term || 'Бессрочно' })}
      <div class="form-error" data-certificate-issue-error></div>
    </form>`, { variant: 'q', surface: 'app', title: 'Оформить сертификат' }));
  if (!layer) return null;
  initDatePickers(layer);
  const form = layer.querySelector('[data-certificate-issue-form]');
  layer.querySelector('[data-certificate-issue-save]')?.addEventListener('click', async () => {
    const error = layer.querySelector('[data-certificate-issue-error]');
    const values = formObject(form);
    const buyer = people.find((item) => String(item?.key || item?.id || '') === String(values.buyerKey || ''));
    const owner = people.find((item) => String(item?.key || item?.id || '') === String(values.ownerKey || ''));
    if (!buyer || !owner) { if (error) error.textContent = 'Укажите покупателя и владельца'; return; }
    const amount = program.type === 'amount' ? Math.max(0, Number(String(values.amount || '0').replace(',', '.')) || 0) : 0;
    if (program.type === 'amount' && amount <= 0) { if (error) error.textContent = 'Укажите номинал'; return; }
    instances.push({
      id: uid('certificate-instance'),
      programId: program.id,
      buyerKey: String(buyer.key || buyer.id || ''),
      buyerName: personLabel(buyer),
      ownerKey: String(owner.key || owner.id || ''),
      ownerName: personLabel(owner),
      initialValue: amount,
      balance: amount,
      status: 'active',
      issuedAt: new Date(`${values.issuedAt}T12:00:00`).toISOString(),
      expiresAt: values.expiresAt || program.term || 'Бессрочно',
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
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-certificate-instance-z' }), { stack: true });
  if (!layer) return null;
  layer.innerHTML = page([
    loyaltyHeader(program.name || 'Сертификат'),
    v2Section('Сертификат', instanceInfo(instance)),
    v2Section('История использования', historyMarkup(instance)),
  ]);
  notifyLoyaltyContext();
  return layer;
}

async function openProgramLayer(root, programId, onChanged) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'loyalty-certificate-program-z' }), { stack: true });
  if (!layer) return null;
  const render = async () => {
    const program = programs.find((item) => item.id === programId);
    if (!program) { layer.v2Close?.(); return; }
    const issued = instances.filter((item) => item.programId === program.id);
    layer.innerHTML = page([
      loyaltyHeader(program.name || 'Сертификат', {
        c: { label: 'Оформить', data: 'data-certificate-issue', aria: 'Оформить сертификат' },
      }),
      v2Section('Условия', programInfo(program)),
      v2Section('Оформленные', issued.length ? v2ListEntries(issued.map((item) => v2ListEntry({
        title: item.ownerName || 'Без имени',
        subtitle: item.buyerName && item.buyerName !== item.ownerName ? `Покупатель: ${item.buyerName}` : 'Покупатель и владелец совпадают',
        rightTop: instanceRight(item),
        interactive: true,
        initial: (item.ownerName || '?').slice(0, 1).toUpperCase(),
        data: `data-certificate-instance="${item.id}"`,
        aria: `Открыть сертификат ${item.ownerName || ''}`,
      }))) : emptyState('Экземпляров пока нет', 'Оформите сертификат конкретному владельцу.')),
    ]);
    layer.querySelector('[data-certificate-issue]')?.addEventListener('click', () => openIssueQ(root, program, async () => {
      await render();
      await onChanged?.();
    }));
    layer.querySelectorAll('[data-certificate-instance]').forEach((node) => node.addEventListener('click', () => openInstanceLayer(root, text(node.dataset.certificateInstance))));
    notifyLoyaltyContext();
  };
  await render();
  return layer;
}

export async function renderCertificate(root) {
  const render = async () => {
    root.innerHTML = page([
      loyaltyHeader('Сертификат', {
        settings: true,
        c: { label: '+', data: 'data-certificate-create', aria: 'Создать вид сертификата' },
      }),
      programs.length ? v2ListEntries(programs.map((program) => v2ListEntry({
        title: program.name,
        subtitle: `${typeLabel(program.type)} · ${program.term || 'Бессрочно'}`,
        rightTop: programRight(program),
        rightBottom: program.status === 'active' ? 'Активен' : 'Закрыт',
        interactive: true,
        initial: program.name.slice(0, 1).toUpperCase(),
        data: `data-certificate-program="${program.id}"`,
        aria: `Открыть ${program.name}`,
      }))) : emptyState('Сертификатов пока нет', 'Создайте первый вид сертификата кнопкой «+».')
    ]);
    bindViewSettings(root, 'Сертификат');
    root.querySelector('[data-certificate-create]')?.addEventListener('click', () => openCreateProgramQ(root, render));
    root.querySelectorAll('[data-certificate-program]').forEach((node) => node.addEventListener('click', () => openProgramLayer(root, text(node.dataset.certificateProgram), render)));
    notifyLoyaltyContext();
  };
  await render();
}
