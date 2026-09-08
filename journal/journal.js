import { pageHeader, viewNavigation, initViewNavigation, headerControl, workplaceContent, ALL_WORKPLACES_ID } from '../ui/ui.js?v=journal-header-split-20260908';
import { getWorkplaceContext, setWorkplaceContext } from '../core/workplace-context.js?v=section-workplace-context-20260908';
import { getWorkplaces } from '../core/workplace-time.js?v=schedule-indicators-20260908';
import { getActiveRecordCountForDay } from './record-data.js?v=journal-record-counts-20260908';
import { openJournalWorkplaceControl } from './workplace-control.js?v=journal-record-counts-20260908';
import { renderJournalDay } from './день.js?v=journal-work-fields-20260908';
import { renderJournalMonth } from './месяц.js?v=journal-all-workplaces-20260908';
import { renderJournalList } from './список.js';

const JOURNAL_CONTEXT_SCOPE = 'journal';

const views = [
  { id: 'day', label: 'День', render: renderJournalDay },
  { id: 'month', label: 'Месяц', render: renderJournalMonth },
  { id: 'list', label: 'Список', render: renderJournalList },
];

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function renderJournal(root) {
  let activeView = 'day';
  const workplaces = getWorkplaces();
  const context = getWorkplaceContext(workplaces, { scope: JOURNAL_CONTEXT_SCOPE });
  let selectedWorkplaceId = context.workplaceId;
  let selectedDate = context.date;

  const renderHeaderControl = () => {
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const workplace = allMode ? null : workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    return headerControl(workplaceContent({ workplace, title: allMode ? 'Все записи' : '' }), {
      data: 'data-workplace-header-open',
      aria: allMode ? 'Все записи по рабочим местам' : `Рабочее место: ${workplace?.name || 'не выбрано'}`,
    });
  };

  const openWorkplace = () => {
    const day = dateKey(selectedDate);
    const recordCounts = Object.fromEntries(workplaces.map((workplace) => {
      const key = String(workplace?.key || '');
      return [key, key ? getActiveRecordCountForDay(day, key) : 0];
    }));

    openJournalWorkplaceControl({
      workplaces,
      workplaceId: selectedWorkplaceId,
      recordCounts,
      onSelect: (nextId) => {
        selectedWorkplaceId = nextId || selectedWorkplaceId;
        setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
        renderView();
      },
    });
  };

  const renderView = () => {
    root.innerHTML = `${pageHeader('Журнал', '', renderHeaderControl())}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
    const viewRoot = root.querySelector('[data-journal-view]');
    if (activeView === 'day') renderJournalDay(viewRoot, { date: selectedDate, workplaceId: selectedWorkplaceId, onChange: (nextDate) => { selectedDate = nextDate; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE }); renderView(); } });
    else if (activeView === 'month') renderJournalMonth(viewRoot, { workplaceId: selectedWorkplaceId, onDateSelect: (nextDate) => { selectedDate = nextDate; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE }); activeView = 'day'; renderView(); } });
    else renderJournalList(viewRoot);
    root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplace);
    initViewNavigation(root, { views, activeView, onChange: (nextView) => { activeView = nextView; renderView(); } });
  };
  renderView();
}
