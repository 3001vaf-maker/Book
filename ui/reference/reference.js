import {
  actionBlock,
  appHeader,
  appShell,
  bottomNavigation,
  button,
} from '../ui.js';

const app = document.querySelector('#app');

const profileSettings = `
  <div class="form-grid" aria-label="Эталон настроек профиля">
    ${button('Личные данные', { variant: 'outline' })}
    ${button('Согласия', { variant: 'outline' })}
    ${button('Изменить пароль')}
    ${button('Выход', { variant: 'danger' })}
  </div>`;

app.innerHTML = appShell({
  header: appHeader({
    title: 'Эталон Book',
    back: { aria: 'Назад' },
    action: { label: 'Сохранить', aria: 'Сохранить' },
    settings: { aria: 'Настройки' },
  }),
  body: `
    ${actionBlock('<strong>Профиль — базовый эталон</strong><div class="muted">Один экран 390 px для мастера и клиента. Все действия на кнопках выровнены по центру.</div>')}
    ${profileSettings}
  `,
  bottomNavigation: bottomNavigation('settings'),
});
