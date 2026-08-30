import { renderMain } from './main/main.js';
import { renderJournal } from './journal/journal.js';
import { renderTimetable } from './timetable/timetable.js';
import { renderChat } from './chat/chat.js';
import { renderSettings } from './settings/settings.js';
import { bottomNavigation } from './ui/ui.js';

const routes = { main: renderMain, timetable: renderTimetable, journal: renderJournal, chat: renderChat, settings: renderSettings };
const state = { activeSection: 'main' };
const app = document.querySelector('#app');

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
  app.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
}

window.addEventListener('hashchange', () => {
  const section = location.hash.slice(1);
  if (routes[section]) { state.activeSection = section; render(); }
});

const initialSection = location.hash.slice(1);
if (routes[initialSection]) state.activeSection = initialSection;
render();
