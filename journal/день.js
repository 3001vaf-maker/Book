import { initDateNavigator } from '../ui/ui.js';

export function renderJournalDay(root, { date = new Date(), onChange = () => {} } = {}) {
  root.innerHTML = '<div data-journal-day-navigator></div>';

  initDateNavigator(root.querySelector('[data-journal-day-navigator]'), {
    date,
    onChange,
  });
}
