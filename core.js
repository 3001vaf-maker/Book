import { renderMain } from './main/main.js';
import { renderJournal } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js';
import { renderChat } from './chat/chat.js';
import { renderSettings } from './settings/settings.js';
import { getWorkplaces as getWorkplaceEntities } from './settings/profile/workplaces/data.js';
import { getWorkingTimeRecordConflicts } from './journal/record-data.js';
import { configureWorkplaceSource } from './core/workplace-time.js';
import { configureWorkingTimeConflictSource } from './core/time-usage.js';
import { getCurrentUser, login } from './core/auth.js';
import { bottomNavigation } from './ui/ui.js';

configureWorkplaceSource(getWorkplaceEntities);
configureWorkingTimeConflictSource(getWorkingTimeRecordConflicts);

const routes = {
  main: renderMain,
  timetable: renderTimetable,
  journal: renderJournal,
  chat: renderChat,
  settings: renderSettings,
};

const state = { activeSection: 'main' };
const app = document.querySelector('#app');
let disposeView = () => {};

function syncViewport() {
  const vv = window.visualViewport;
  const height = vv?.height || window.innerHeight;
  const width = vv?.width || window.innerWidth;
  document.documentElement.style.setProperty('--visual-vh', `${height}px`);
  document.documentElement.style.setProperty('--visual-vw', `${width}px`);
  document.documentElement.classList.toggle('keyboard-open', vv ? height < window.innerHeight * 0.78 : false);
}

function navigate(section) {
  if (!routes[section]) return;
  state.activeSection = section;
  render();
  history.replaceState({}, '', `#${section}`);
}

function render() {
  disposeView();
  disposeView = () => {};
  const view = routes[state.activeSection];
  app.innerHTML = `<main class="app-content" id="app-content"></main>${bottomNavigation(state.activeSection)}`;
  const nextDispose = view(document.querySelector('#app-content'), { navigate });
  if (typeof nextDispose === 'function') disposeView = nextDispose;
  app.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.nav));
  });
  syncViewport();
}

function renderLogin(message = '') {
  disposeView();
  disposeView = () => {};
  app.innerHTML = `
    <main class="auth-view">
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="auth-card__heading">
          <h1 id="auth-title">Book</h1>
          <p>Вход в рабочее пространство</p>
        </div>
        <form class="auth-form" id="auth-form">
          <label class="field">
            <span>Email</span>
            <input name="email" type="email" autocomplete="username" required>
          </label>
          <label class="field">
            <span>Пароль</span>
            <input name="password" type="password" autocomplete="current-password" required>
          </label>
          <p class="auth-error" id="auth-error" role="alert">${message}</p>
          <button class="ui-button" type="submit">Войти</button>
        </form>
      </section>
    </main>`;

  const form = app.querySelector('#auth-form');
  const error = app.querySelector('#auth-error');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Входим…';
    const data = new FormData(form);

    try {
      await login(data.get('email'), data.get('password'));
      render();
    } catch (loginError) {
      error.textContent = loginError instanceof Error ? loginError.message : 'Не удалось войти';
      button.disabled = false;
      button.textContent = 'Войти';
    }
  });

  syncViewport();
}

window.addEventListener('hashchange', () => {
  const section = location.hash.slice(1);
  if (routes[section]) {
    state.activeSection = section;
    render();
  }
});
window.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches('input, select, textarea')) return;
  window.setTimeout(() => target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 120);
}, { passive: true });

const initialSection = location.hash.slice(1);
if (routes[initialSection]) state.activeSection = initialSection;
syncViewport();

try {
  const currentUser = await getCurrentUser();
  if (currentUser) render();
  else renderLogin();
} catch {
  renderLogin('Сервер временно недоступен');
}
