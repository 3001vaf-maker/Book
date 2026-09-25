import {
  accordion,
  appHeader,
  appShell,
  bottomNavigation,
  button,
  columnLayout,
  dateNavigator,
  details,
  entityCard,
  field,
  folderList,
  iconButton,
  initAccordions,
  initCalendar,
  initMonthDayPickers,
  initRepeatedFields,
  initSegmentControls,
  list,
  listEntries,
  listEntry,
  mediaRail,
  modal,
  monthDayPicker,
  mountModal,
  repeatedField,
  segmentControl,
  select,
  textareaField,
  twoColumnLayout,
} from '../ui.js';
import { messageComposer, messageThread } from '../chat/index.js';
import { readOnlyReceipt } from '../receipt/index.js';
import { settingToggle } from '../settings/index.js';

const app = document.querySelector('#app');
const controls = document.querySelector('#reference-controls');

const ACTION_LABELS = ['Сохранить', 'Далее', 'Готово', 'Добавить', 'Создать'];
const HEADER_MODES = ['AJ', 'AJB', 'AJC', 'AJBC'];
const SCREEN_OPTIONS = [
  ['profile', 'Карточка — без S'],
  ['profile-media', 'Карточка — с S'],
  ['chat', 'Чат'],
  ['form', 'Форма'],
  ['fields', 'Поля и телефон'],
  ['blocks', 'Блоки 1–3'],
  ['lists', 'List / Entry List'],
  ['receipt', 'Отчётный лист'],
  ['date', 'День / календарь'],
  ['folders', 'Папки'],
  ['controls', 'Аккордеон / переключатель'],
  ['modals', 'Модальные окна'],
  ['empty', 'Пустой экран'],
];

const state = {
  screen: 'profile',
  actionLabel: 'Сохранить',
  headerMode: 'AJBC',
  longTitle: false,
  chatAttachments: true,
};

function optionList(items, current) {
  return items.map(([value, label]) => `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`).join('');
}

function section(title, content, note = '') {
  return `<section class="ui-reference-section"><h2>${title}</h2>${note ? `<p>${note}</p>` : ''}${content}</section>`;
}

function renderToolbar() {
  controls.innerHTML = `
    <details open>
      <summary>Эталон Book UI</summary>
      <div class="ui-reference-controls">
        <label class="ui-reference-control">
          <span>Форма экрана</span>
          <select data-reference-screen>${optionList(SCREEN_OPTIONS, state.screen)}</select>
        </label>
        <label class="ui-reference-control">
          <span>Шапка</span>
          <select data-reference-header>${optionList(HEADER_MODES.map((value) => [value, value.replace('J', ' + J').replaceAll('B', ' + B').replaceAll('C', ' + C')]), state.headerMode)}</select>
        </label>
        <label class="ui-reference-control">
          <span>Текст B</span>
          <select data-reference-action>${optionList(ACTION_LABELS.map((value) => [value, value]), state.actionLabel)}</select>
        </label>
        <div class="ui-reference-inline">
          <label class="ui-reference-control">
            <span>J</span>
            <button type="button" data-reference-title>${state.longTitle ? 'Длинный' : 'Короткий'}</button>
          </label>
          <label class="ui-reference-control">
            <span>Чат</span>
            <button type="button" data-reference-attachments>${state.chatAttachments ? 'Со скрепкой' : 'Без скрепки'}</button>
          </label>
        </div>
        <p class="ui-reference-note">Панель снаружи телефона — только управление стендом. Внутри 390 px используются реальные общие компоненты Book, без API и бизнес-данных.</p>
      </div>
    </details>`;

  controls.querySelector('[data-reference-screen]')?.addEventListener('change', (event) => {
    state.screen = event.target.value;
    render();
  });
  controls.querySelector('[data-reference-header]')?.addEventListener('change', (event) => {
    state.headerMode = event.target.value;
    render();
  });
  controls.querySelector('[data-reference-action]')?.addEventListener('change', (event) => {
    state.actionLabel = event.target.value;
    render();
  });
  controls.querySelector('[data-reference-title]')?.addEventListener('click', () => {
    state.longTitle = !state.longTitle;
    render();
  });
  controls.querySelector('[data-reference-attachments]')?.addEventListener('click', () => {
    state.chatAttachments = !state.chatAttachments;
    render();
  });
}

function genericCard() {
  return entityCard({
    id: 'ID 0000',
    title: 'Заголовок карточки',
    subtitle: 'Подзаголовок',
    className: 'entity-card--hero ui-reference-generic-card',
    topMeta: [
      { value: 'Зона 1', label: 'Подпись', row: 1 },
      { value: 'Строка', label: 'Подпись', row: 2, weight: 'regular' },
    ],
    topRightMeta: [
      { value: 'Зона 2', label: 'Подпись', row: 2, weight: 'regular' },
      { value: '00:00', row: 3 },
    ],
    meta: [
      { value: '00', label: 'Показатель' },
      { value: '00', label: 'Показатель' },
      { value: '00', label: 'Показатель' },
    ],
    detailRows: [
      { left: 'Строка интерфейса', right: 'Значение' },
      { left: 'Строка интерфейса', right: 'Значение' },
    ],
  });
}

function profileScreen(withMedia = false) {
  return {
    className: 'app-view-shell--profile',
    media: withMedia ? mediaRail([
      { label: 'Элемент 1' },
      { label: 'Элемент 2' },
      { label: 'Элемент 3' },
      { label: 'Элемент 4' },
      { label: 'Элемент 5' },
      { label: 'Элемент 6' },
    ]) : '',
    body: genericCard(),
  };
}

function chatScreen() {
  const messages = [
    { id: '1', direction: 'inbound', body: 'Короткое входящее сообщение', time: '10:10' },
    { id: '2', direction: 'outbound', body: 'Ответ немного длиннее, чтобы проверить ширину пузыря и перенос текста.', time: '10:11' },
    { id: '3', direction: 'system', body: 'Системная строка', time: '10:12' },
  ];
  return {
    className: 'app-view-shell--chat',
    media: '',
    body: `${messageThread(messages, { viewer: 'profile' })}${messageComposer({ attachments: state.chatAttachments })}`,
  };
}

function formScreen() {
  return {
    className: '',
    media: '',
    body: `<div class="form-grid">
      ${field({ label: 'Короткое поле', name: 'referenceText', placeholder: 'Введите значение' })}
      ${field({ label: 'Длинная подпись поля для проверки переноса', name: 'referenceLong', placeholder: 'Текст' })}
      ${select({ label: 'Select', name: 'referenceSelect', value: 'one', options: [
        { value: 'one', label: 'Короткое значение' },
        { value: 'two', label: 'Очень длинное значение для проверки ширины Select на экране 390 px' },
        { value: 'three', label: 'Третье значение' },
      ] })}
      ${textareaField({ label: 'Textarea', name: 'referenceTextarea', placeholder: 'Несколько строк текста' })}
      ${button('Основное действие')}
      ${button('Вторичное действие', { variant: 'outline' })}
      ${button('Вторичное действие', { variant: 'secondary' })}
    </div>`,
  };
}

function fieldsScreen() {
  return {
    className: '',
    media: '',
    body: `<div class="ui-reference-stack">
      ${section('Поле + ×', repeatedField({ label: 'Поле', name: 'referenceRepeated', values: ['Значение'], placeholder: 'Значение', addLabel: '+ Добавить' }))}
      ${section('Телефон в одну строку', repeatedField({ label: 'Телефон', name: 'referencePhone', values: ['+79031234567'], type: 'tel', addLabel: '+ Добавить телефон' }), 'Слева код страны, по центру номер, справа ×.')}
      ${section('Select — длинное значение', select({ label: 'Выбор', name: 'referenceLongSelect', value: 'long', options: [
        { value: 'short', label: 'Коротко' },
        { value: 'long', label: 'Очень длинное значение, которое не должно растягивать экран Book вправо' },
      ] }))}
    </div>`,
  };
}

function blocksScreen() {
  const oneField = columnLayout([
    field({ label: 'Поле 1', name: 'blockOne', value: '10' }),
  ], { columns: 1, ariaLabel: 'Один ввод' });
  const twoFields = columnLayout([
    field({ label: 'Поле 1', name: 'blockTwoA', value: '10' }),
    field({ label: 'Поле 2', name: 'blockTwoB', value: '20' }),
  ], { columns: 2, ariaLabel: 'Два ввода' });
  const threeFields = columnLayout([
    field({ label: 'Поле 1', name: 'blockThreeA', value: '10' }),
    field({ label: 'Поле 2', name: 'blockThreeB', value: '20' }),
    field({ label: 'Поле 3', name: 'blockThreeC', value: '30' }),
  ], { columns: 3, ariaLabel: 'Три ввода' });

  return {
    className: '',
    media: '',
    body: `<div class="ui-reference-stack">
      <div class="ui-reference-value-block"><strong>Заголовок — два значения</strong>${details([{ left: 'Значение 1', right: 'Значение 2' }], { variant: 'split' })}${twoFields}</div>
      <div class="ui-reference-value-block"><strong>Заголовок — три значения</strong>${columnLayout(['<strong>Значение 1</strong>', '<strong>Значение 2</strong>', '<strong>Значение 3</strong>'], { columns: 3, ariaLabel: 'Три значения' })}${threeFields}</div>
      <div class="ui-reference-value-block"><strong>Один ввод</strong>${oneField}</div>
    </div>`,
  };
}

function listsScreen() {
  const simpleList = list({
    items: [
      { title: 'Одна строка' },
      { title: 'Две строки', secondary: 'Вторая строка' },
      { title: 'Три зоны', secondary: 'Слева', right: ['Справа 1', 'Справа 2'] },
    ],
  });
  const entries = listEntries([
    listEntry({ columns: [[{ value: '1 столбец', strong: true }, 'Строка 2', 'Строка 3']], interactive: false }),
    listEntry({ columns: [[{ value: 'Лево', strong: true }, 'Строка 2'], [{ value: 'Право', strong: true }, 'Строка 2', 'Строка 3']], interactive: false }),
    listEntry({ columns: [[{ value: 'Лево', strong: true }, 'Строка 2'], [{ value: 'Центр', strong: true }, 'Строка 2'], [{ value: 'Право', strong: true }, 'Строка 2', 'Строка 3']], interactive: false }),
  ]);
  return {
    className: '',
    media: '',
    body: `<div class="ui-reference-list-stack">${section('List', simpleList)}${section('Entry List — 1 / 2 / 3 столбца', entries, 'Каждый столбец поддерживает до трёх строк.')}</div>`,
  };
}

function receiptScreen() {
  return {
    className: '',
    media: '',
    body: readOnlyReceipt({
      title: 'Отчётный лист',
      status: 'Статус',
      date: '00.00.0000',
      time: '00:00',
      items: [
        { label: 'Строка 1', value: '1 000' },
        { label: 'Строка 2', value: '2 000' },
        { label: 'Строка 3', value: '3 000' },
      ],
      totals: [
        { label: 'Итого', value: '6 000', strong: true },
      ],
    }),
  };
}

function dateScreen() {
  return {
    className: '',
    media: '',
    body: `<div class="ui-reference-stack">
      ${section('Поле дня', monthDayPicker({ name: 'referenceDay', label: 'День', value: '09-14' }))}
      ${section('Навигация по дню', dateNavigator({ date: new Date(2026, 8, 14) }))}
      ${section('Календарь', '<div class="ui-reference-calendar-host" data-reference-calendar></div>')}
    </div>`,
  };
}

function foldersScreen() {
  return {
    className: '',
    media: '',
    body: folderList([
      { title: 'Папка' },
      { title: 'Папка с длинным названием' },
      { title: 'Ещё одна папка' },
    ]),
  };
}

function controlsScreen() {
  return {
    className: '',
    media: '',
    body: `<div class="ui-reference-stack">
      <div class="ui-reference-info-row">${iconButton('ⓘ', { data: 'data-reference-info', aria: 'Информация' })}</div>
      ${section('Переключатель — 2 значения', segmentControl([
        { value: 'one', label: 'Первое' },
        { value: 'two', label: 'Второе' },
      ], { value: 'one', name: 'referenceSegmentTwo' }))}
      ${section('Переключатель — 3 значения', segmentControl([
        { value: 'one', label: 'Первое' },
        { value: 'two', label: 'Второе' },
        { value: 'three', label: 'Третье' },
      ], { value: 'two', name: 'referenceSegmentThree' }))}
      ${section('Аккордеон', accordion([
        { title: 'Раздел 1', value: 'Значение', content: field({ label: 'Поле', name: 'accordionOne', value: '10' }) },
        { title: 'Раздел 2', valueLeft: 'Слева', value: 'Справа', content: textareaField({ label: 'Текст', name: 'accordionTwo', value: 'Текст' }) },
        { title: 'Раздел 3', content: select({ label: 'Выбор', name: 'accordionThree', value: 'one', options: [{ value: 'one', label: 'Первое' }, { value: 'two', label: 'Второе' }] }) },
      ], { openFirst: true }))}
    </div>`,
  };
}

function modalsScreen() {
  return {
    className: '',
    media: '',
    body: `<div class="ui-reference-stack">
      ${section('4 модальных окна', `<div class="ui-reference-actions">
        ${button('Compact', { variant: 'outline', data: 'data-reference-modal="compact"' })}
        ${button('Medium', { variant: 'outline', data: 'data-reference-modal="medium"' })}
        ${button('Large', { variant: 'outline', data: 'data-reference-modal="large"' })}
        ${button('List', { variant: 'outline', data: 'data-reference-modal="list"' })}
      </div>`, 'Все ограничены общей шириной Book 390 px.')}
    </div>`,
  };
}

function emptyScreen() {
  return {
    className: '',
    media: '',
    body: '<div class="ui-reference-empty"><div><strong>Пустое состояние</strong><span>Здесь проверяется положение текста без данных.</span></div></div>',
  };
}

function currentScreen() {
  if (state.screen === 'profile-media') return profileScreen(true);
  if (state.screen === 'chat') return chatScreen();
  if (state.screen === 'form') return formScreen();
  if (state.screen === 'fields') return fieldsScreen();
  if (state.screen === 'blocks') return blocksScreen();
  if (state.screen === 'lists') return listsScreen();
  if (state.screen === 'receipt') return receiptScreen();
  if (state.screen === 'date') return dateScreen();
  if (state.screen === 'folders') return foldersScreen();
  if (state.screen === 'controls') return controlsScreen();
  if (state.screen === 'modals') return modalsScreen();
  if (state.screen === 'empty') return emptyScreen();
  return profileScreen(false);
}

function currentTitle() {
  if (state.longTitle) return 'Очень длинное название раздела для проверки заголовка';
  return SCREEN_OPTIONS.find(([value]) => value === state.screen)?.[1].replace(/ —.+$/, '') || 'Эталон Book';
}

function header() {
  const hasA = state.headerMode.includes('A');
  const hasB = state.headerMode.includes('B');
  const hasC = state.headerMode.includes('C');
  return appHeader({
    title: currentTitle(),
    back: hasA ? { aria: 'Назад' } : null,
    action: hasB ? { label: state.actionLabel, data: 'data-reference-header-action', aria: state.actionLabel } : null,
    settings: hasC ? { data: 'data-reference-settings', aria: 'Настройки' } : null,
  });
}

function settingsMarkup() {
  return `<div class="ui-reference-modal-content">
    <div class="modal-title"><h2>Настройки профиля</h2><p>Эталон расположения и вида действий.</p></div>
    <div class="form-grid">
      ${button('Личные данные', { variant: 'outline', data: 'data-reference-personal' })}
      ${button('Согласия', { variant: 'outline', data: 'data-reference-consents' })}
      ${button('Изменить пароль', { data: 'data-reference-password' })}
      ${button('Выход', { variant: 'danger', data: 'data-reference-logout' })}
    </div>
  </div>`;
}

function openSettingsReference() {
  const host = mountModal(document.body, modal(settingsMarkup(), { variant: 'medium', surface: 'app', title: 'Настройки профиля' }));
  if (!host) return;
  host.querySelector('[data-reference-personal]')?.addEventListener('click', () => openPersonalDataReference());
  host.querySelector('[data-reference-consents]')?.addEventListener('click', () => openConsentReference());
  host.querySelector('[data-reference-password]')?.addEventListener('click', () => openPasswordReference());
  host.querySelector('[data-reference-logout]')?.addEventListener('click', (event) => event.preventDefault());
}

function openPersonalDataReference() {
  const content = `<div class="ui-reference-modal-content">
    <div class="modal-title"><h2>Личные данные</h2><p>Набор общих полей без сохранения и серверной логики.</p></div>
    <div class="form-grid">
      ${field({ label: 'Имя', name: 'referenceName', value: 'Текст' })}
      ${repeatedField({ label: 'Телефон', name: 'referencePersonalPhone', values: ['+79031234567'], type: 'tel', addLabel: '+ Добавить телефон' })}
      ${field({ label: 'Email', name: 'referenceEmail', type: 'email', placeholder: 'name@example.com' })}
      ${select({ label: 'Выбор', name: 'referenceChoice', value: 'one', options: [
        { value: 'one', label: 'Вариант 1' },
        { value: 'two', label: 'Вариант с длинным названием для проверки' },
      ] })}
      ${textareaField({ label: 'Комментарий', name: 'referenceComment', placeholder: 'Текст' })}
      <div class="ui-reference-modal-actions">${button('Сохранить')}${button('Отмена', { variant: 'outline', data: 'data-modal-close' })}</div>
    </div>
  </div>`;
  const host = mountModal(document.body, modal(content, { variant: 'large', surface: 'app', title: 'Личные данные' }));
  if (host) initRepeatedFields(host);
}

function openConsentReference() {
  const content = `<div class="ui-reference-modal-content">
    <div class="modal-title"><h2>Согласия</h2><p>Пример строк состояния без изменения реальных данных.</p></div>
    ${settingToggle({ label: 'Согласие 1', checked: true })}
    ${settingToggle({ label: 'Согласие 2', checked: false })}
    <div class="ui-reference-modal-actions">${button('Закрыть', { variant: 'outline', data: 'data-modal-close' })}</div>
  </div>`;
  mountModal(document.body, modal(content, { variant: 'medium', surface: 'app', title: 'Согласия' }));
}

function openPasswordReference() {
  const content = `<div class="ui-reference-modal-content">
    <div class="modal-title"><h2>Изменить пароль</h2><p>Только форма интерфейса.</p></div>
    <div class="form-grid">
      ${field({ label: 'Текущий пароль', name: 'referenceCurrentPassword', type: 'password' })}
      ${field({ label: 'Новый пароль', name: 'referenceNewPassword', type: 'password' })}
      ${field({ label: 'Повторите новый пароль', name: 'referenceRepeatPassword', type: 'password' })}
      ${button('Сохранить')}
    </div>
  </div>`;
  mountModal(document.body, modal(content, { variant: 'medium', surface: 'app', title: 'Изменить пароль' }));
}

function openInfoReference() {
  mountModal(document.body, modal('<div class="modal-title"><h2>Информация</h2><p>Нейтральный информационный текст без бизнес-логики.</p></div>', {
    title: 'Информация',
    variant: 'compact',
    surface: 'app',
  }));
}

function openModalReference(variant) {
  const isList = variant === 'list';
  const content = `<div class="ui-reference-modal-content"><div class="modal-title"><h2>${variant}</h2><p>Эталон размера модального окна.</p></div>${isList ? folderList([{ title: 'Строка 1' }, { title: 'Строка 2' }, { title: 'Строка 3' }]) : `<div class="form-grid">${field({ label: 'Поле', name: `referenceModal${variant}`, value: 'Значение' })}${button('Действие')}</div>`}</div>`;
  mountModal(document.body, modal(content, { variant, surface: 'app', title: `Модальное окно ${variant}` }));
}

function bindReferenceEvents() {
  app.querySelector('[data-reference-settings]')?.addEventListener('click', openSettingsReference);
  app.querySelector('[data-reference-header-action]')?.addEventListener('click', () => {
    const index = ACTION_LABELS.indexOf(state.actionLabel);
    state.actionLabel = ACTION_LABELS[(index + 1) % ACTION_LABELS.length];
    render();
  });
  app.querySelector('[data-message-composer]')?.addEventListener('submit', (event) => event.preventDefault());
  app.querySelector('[data-reference-info]')?.addEventListener('click', openInfoReference);
  app.querySelectorAll('[data-reference-modal]').forEach((control) => control.addEventListener('click', () => openModalReference(control.dataset.referenceModal)));

  initRepeatedFields(app);
  initAccordions(app);
  initSegmentControls(app);
  initMonthDayPickers(app);

  const calendarHost = app.querySelector('[data-reference-calendar]');
  if (calendarHost) initCalendar(calendarHost, { selectedValue: '2026-09-14', month: new Date(2026, 8, 1) });
}

function renderPhone() {
  const screen = currentScreen();
  app.innerHTML = appShell({
    header: header(),
    media: screen.media,
    body: screen.body,
    className: screen.className,
    bottomNavigation: bottomNavigation('settings'),
  });
  bindReferenceEvents();
}

function render() {
  renderToolbar();
  renderPhone();
}

render();
