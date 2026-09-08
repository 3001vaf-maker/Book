import { pageHeader, viewNavigation, initViewNavigation, headerControl, workplaceContent, openWorkplaceControl, getWorkplaceContext, setWorkplaceContext } from '../ui/ui.js?v=header-control-v2-20260908';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, saveDays, getDay, getDayTime, updateDayTime, hasScheduleConflict } from '../core/day.js';
import { renderJournalDay } from './день.js?v=journal-architecture-20260908';
import { renderJournalMonth } from './месяц.js';
import { renderJournalList } from './список.js';

function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
const views = [
  { id: 'day', label: 'День', render: renderJournalDay },
  { id: 'month', label: 'Месяц', render: renderJournalMonth },
  { id: 'list', label: 'Список', render: renderJournalList },
];

export function renderJournal(root) {
  let activeView = 'day';
  const workplaces = getWorkplaces();
  const context = getWorkplaceContext(workplaces);
  let selectedWorkplaceId = context.workplaceId;
  let selectedDate = context.date;

  const renderHeaderControl = () => {
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    return headerControl(workplaceContent({ workplace }), {
      data: 'data-workplace-header-open',
      aria: `Рабочее место: ${workplace?.name || 'не выбрано'}`,
    });
  };

  const openWorkplace = () => {
    const days = getDays();
    const date = dateKey(selectedDate);
    const day = getDay(days, selectedWorkplaceId, date);
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const current = day ? getDayTime(day, workplaces) : null;
    const time = day && workplace ? { from: current?.from || workplace.from || '09:00', to: current?.to || workplace.to || '18:00' } : null;

    openWorkplaceControl({
      workplaces,
      workplaceId: selectedWorkplaceId,
      canCorrectTime: Boolean(day && workplace),
      time,
      onSelect: (nextId) => {
        selectedWorkplaceId = nextId || selectedWorkplaceId;
        setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate });
        renderView();
      },
      onSaveTime: ({ from, to }) => {
        if (hasScheduleConflict(days, { workplaceId: selectedWorkplaceId, date, from, to })) {
          return { ok: false, message: 'Это время пересекается с другой работой мастера. Выберите другое время.' };
        }
        if (!updateDayTime(days, selectedWorkplaceId, date, from, to)) {
          return { ok: false, message: 'Проверьте рабочее время.' };
        }
        saveDays(days);
        renderView();
        return { ok: true };
      },
    });
  };

  const renderView = () => {
    root.innerHTML = `${pageHeader('Журнал', '', renderHeaderControl())}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
    const viewRoot = root.querySelector('[data-journal-view]');
    if (activeView === 'day') renderJournalDay(viewRoot, { date: selectedDate, workplaceId: selectedWorkplaceId, onChange: (nextDate) => { selectedDate = nextDate; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate }); renderView(); } });
    else if (activeView === 'month') renderJournalMonth(viewRoot, { workplaceId: selectedWorkplaceId, onDateSelect: (nextDate) => { selectedDate = nextDate; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate }); activeView = 'day'; renderView(); } });
    else renderJournalList(viewRoot);
    root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplace);
    initViewNavigation(root, { views, activeView, onChange: (nextView) => { activeView = nextView; renderView(); } });
  };
  renderView();
}
