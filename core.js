import { renderMain } from './main/main.js';
import { renderJournal } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js?v=graph-persist-20260903';
import { renderChat } from './chat/chat.js';
import { renderSettings } from './settings/settings.js';
import { bottomNavigation } from './ui/ui.js';

const routes = {
  main: renderMain,
  timetable: renderTimetable,
  journal: renderJournal,
  chat: renderChat,
  settings: renderSettings,
};

const state = { activeSection: 'main' };
const app = document.querySelector('#app');

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
  const view = routes[state.activeSection];
  app.innerHTML = `<main class="app-content" id="app-content"></main>${bottomNavigation(state.activeSection)}`;
  view(document.querySelector('#app-content'), { navigate });
  app.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.nav));
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
render();
