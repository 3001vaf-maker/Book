import { pageHeader, viewNavigation, initViewNavigation } from '../ui/ui.js';
import { renderJournalDay } from './день.js';
import { renderJournalMonth } from './месяц.js';
import { renderJournalList } from './список.js';

const views = [
  { id: 'day', label: 'День', render: renderJournalDay },
  { id: 'month', label: 'Месяц', render: renderJournalMonth },
  { id: 'list', label: 'Список', render: renderJournalList },
];

export function renderJournal(root) {
  let activeView = 'day';

  const renderView = () => {
    root.innerHTML = `${pageHeader('Журнал')}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
    views.find(({ id }) => id === activeView).render(root.querySelector('[data-journal-view]'));
    initViewNavigation(root, {
      views,
      activeView,
      onChange: (nextView) => {
        activeView = nextView;
        renderView();
      },
    });
  };

  renderView();
}
