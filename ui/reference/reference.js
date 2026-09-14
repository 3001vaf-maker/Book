import {
  appHeader,
  appShell,
  bottomNavigation,
  button,
  entityCard,
  field,
  folderList,
  mediaRail,
  messageComposer,
  messageThread,
  modal,
  mountModal,
  select,
  settingToggle,
  textareaField,
} from '../ui.js';

const app = document.querySelector('#app');
const controls = document.querySelector('#reference-controls');

const ACTION_LABELS = ['Сохранить', 'Далее', 'Готово', 'Добавить', 'Создать'];
const HEADER_MODES = ['AJ', 'AJB', 'AJC', 'AJBC'];
const SCREEN_OPTIONS = [
  ['profile', 'Карточка — без S'],
  ['profile-media', 'Карточка — с S'],
  ['chat', 'Чат'],
  ['form', 'Форма'],
  ['list', 'Список'],
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
    body: `${messageThread(messages, { viewer: 'master' })}${messageComposer({ attachments: state.chatAttachments })}`,
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

function listScreen() {
  return {
    className: '',
    media: '',
    body: folderList([
      { title: 'Раздел' },
      { title: 'Раздел с более длинным названием' },
      { title: 'Ещё один раздел' },
    ]),
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
  if (state.screen === 'list') return listScreen();
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
      ${field({ label: 'Телефон', name: 'referencePhone', type: 'tel', placeholder: '+7 000 000-00-00' })}
      ${field({ label: 'Email', name: 'referenceEmail', type: 'email', placeholder: 'name@example.com' })}
      ${select({ label: 'Выбор', name: 'referenceChoice', value: 'one', options: [
        { value: 'one', label: 'Вариант 1' },
        { value: 'two', label: 'Вариант с длинным названием для проверки' },
      ] })}
      ${textareaField({ label: 'Комментарий', name: 'referenceComment', placeholder: 'Текст' })}
      <div class="ui-reference-modal-actions">${button('Сохранить')}${button('Отмена', { variant: 'outline', data: 'data-modal-close' })}</div>
    </div>
  </div>`;
  mountModal(document.body, modal(content, { variant: 'large', surface: 'app', title: 'Личные данные' }));
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

function bindReferenceEvents() {
  app.querySelector('[data-reference-settings]')?.addEventListener('click', openSettingsReference);
  app.querySelector('[data-reference-header-action]')?.addEventListener('click', () => {
    const index = ACTION_LABELS.indexOf(state.actionLabel);
    state.actionLabel = ACTION_LABELS[(index + 1) % ACTION_LABELS.length];
    render();
  });
  app.querySelector('[data-message-composer]')?.addEventListener('submit', (event) => event.preventDefault());
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
