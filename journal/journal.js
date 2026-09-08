import { pageHeader, viewNavigation, initViewNavigation, headerControl, workplaceContent, ALL_WORKPLACES_ID, openDayWorkplaceTime } from '../ui/ui.js?v=day-workplaces-records-20260908';
import { getWorkplaceContext, setWorkplaceContext } from '../core/workplace-context.js?v=section-workplace-context-20260908';
import { getWorkplaces } from '../core/workplace-time.js?v=schedule-indicators-20260908';
import { getActiveDayWorkplaces, getAvailableDayWorkplaces, getDayWorkplaceDraft, saveDayWorkplaceTime } from '../core/day-workplaces.js?v=day-workplaces-20260908';
import { getActiveRecordCountForDay } from './record-data.js?v=journal-record-counts-20260908';
import { openJournalWorkplaceControl } from './workplace-control.js?v=journal-day-active-workplaces-20260908';
import { renderJournalDay } from './день.js?v=journal-all-workplaces-20260908';
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

  const activeDayWorkplaces = () => getActiveDayWorkplaces(selectedDate, workplaces);

  const renderHeaderControl = () => {
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const workplace = allMode ? null : workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    return headerControl(workplaceContent({ workplace, title: allMode ? 'Все записи' : '' }), {
      data: 'data-workplace-header-open',
      aria: allMode ? 'Все записи по рабочим местам' : `Рабочее место: ${workplace?.name || 'не выбрано'}`,
    });
  };

  const openDayTime = (workplaceId) => {
    const workplace = workplaces.find((item) => String(item?.key || '') === String(workplaceId || '')) || null;
    const draft = getDayWorkplaceDraft(selectedDate, workplaceId, workplaces);
    if (!draft) return;

    openDayWorkplaceTime({
      title: workplace?.name || 'Рабочее место',
      from: draft.from,
      to: draft.to,
      occupied: draft.occupied,
      onSave: ({ from, to }) => {
        const result = saveDayWorkplaceTime({ date: selectedDate, workplaceId, from, to }, workplaces);
        if (!result.ok) return result;
        setWorkplaceContext({ date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
        renderView();
        return result;
      },
    });
  };

  const selectWorkplace = (nextId) => {
    selectedWorkplaceId = nextId || selectedWorkplaceId;
    setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
    renderView();
  };

  const openDayWorkplaces = () => {
    const day = dateKey(selectedDate);
    const active = activeDayWorkplaces().map((item) => {
      const workplace = workplaces.find((entry) => String(entry?.key || '') === String(item.workplaceId || '')) || null;
      return {
        ...(workplace || {}),
        key: item.workplaceId,
        name: item.name,
        indicatorColor: item.indicatorColor,
      };
    });
    const recordCounts = Object.fromEntries(active.map((workplace) => {
      const key = String(workplace?.key || '');
      return [key, key ? getActiveRecordCountForDay(day, key) : 0];
    }));
    const available = getAvailableDayWorkplaces(selectedDate, workplaces);

    openJournalWorkplaceControl({
      workplaces: active,
      workplaceId: selectedWorkplaceId,
      recordCounts,
      available,
      onSelect: selectWorkplace,
      onAdd: openDayTime,
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
      onSelect: selectWorkplace,
    });
  };

  const renderView = () => {
    root.innerHTML = `${pageHeader('Журнал', '', renderHeaderControl())}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
    const viewRoot = root.querySelector('[data-journal-view]');
    if (activeView === 'day') {
      renderJournalDay(viewRoot, {
        date: selectedDate,
        workplaceId: selectedWorkplaceId,
        onChange: (nextDate) => {
          selectedDate = nextDate;
          setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
          renderView();
        },
      });
    } else if (activeView === 'month') {
      renderJournalMonth(viewRoot, {
        workplaceId: selectedWorkplaceId,
        onDateSelect: (nextDate) => {
          selectedDate = nextDate;
          setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
          activeView = 'day';
          renderView();
        },
      });
    } else renderJournalList(viewRoot);

    root.querySelector('[data-workplace-header-open]')?.addEventListener('click', activeView === 'day' ? openDayWorkplaces : openWorkplace);
    initViewNavigation(root, { views, activeView, onChange: (nextView) => { activeView = nextView; renderView(); } });
  };
  renderView();
}
