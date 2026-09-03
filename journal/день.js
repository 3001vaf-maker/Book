import { initDateNavigator } from '../ui/ui.js';

export function renderJournalDay(root) {
  root.innerHTML = '<div data-journal-day-navigator></div>';

  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), {
    date: new Date(),
  });
}
