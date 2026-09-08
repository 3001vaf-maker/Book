import { pageHeader, viewNavigation, initViewNavigation, headerControl, workplaceContent, ALL_WORKPLACES_ID, dayWorkplaceContent, openDayWorkplaceControl, openDayWorkplaceTime } from '../ui/ui.js?v=day-workplaces-records-20260908';
import { getWorkplaceContext, setWorkplaceContext } from '../core/workplace-context.js?v=section-workplace-context-20260908';
import { getWorkplaces } from '../core/workplace-time.js?v=schedule-indicators-20260908';
import { getActiveDayWorkplaces, getAvailableDayWorkplaces, getDayWorkplaceDraft, saveDayWorkplaceTime } from '../core/day-workplaces.js?v=day-workplaces-20260908';
import { getActiveRecordCountForDay } from './record-data.js?v=journal-record-counts-20260908';
import { openJournalWorkplaceControl } from './workplace-control.js?v=journal-record-counts-20260908';
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

function dayRenderWorkplaceId(items = []) {
  const active = Array.isArray(items) ? items : [];
  if (active.length > 1) return ALL_WORKPLACES_ID;
  return active[0]?.workplaceId || '';
}

export function renderJournal(root) {
  let activeView = 'day';
  const workplaces = getWorkplaces();
  const context = getWorkplaceContext(workplaces, { scope: JOURNAL_CONTEXT_SCOPE });
  let selectedWorkplaceId = context.workplaceId;
  let selectedDate = context.date;

  const activeDayWorkplaces = () => getActiveDayWorkplaces(selectedDate, workplaces);

  const renderHeaderControl = () => {
    if (activeView === 'day') {
      const items = activeDayWorkplaces();
      const names = items.map((item) => item.name).filter(Boolean).join(', ');
      return headerControl(dayWorkplaceContent({ items }), {
        data: 'data-day-workplaces-open',
        aria: names ? `Рабочие места дня: ${names}` : 'Добавить рабочее место',
      });
    }

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

  const openDayWorkplaces = () => {
    const day = dateKey(selectedDate);
    const active = activeDayWorkplaces().map((item) => ({
      ...item,
      right: [`${getActiveRecordCountForDay(day, item.workplaceId)} з`],
    }));
    const available = getAvailableDayWorkplaces(selectedDate, workplaces);
    openDayWorkplaceControl({
      active,
      available,
      title: 'Рабочие места дня',
      catalogTitle: 'Добавить рабочее место',
      onEdit: openDayTime,
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
    if (activeView === 'day') {
      const dayWorkplaceId = dayRenderWorkplaceId(activeDayWorkplaces());
      renderJournalDay(viewRoot, {
        date: selectedDate,
        workplaceId: dayWorkplaceId,
        onChange: (nextDate) => {
          selectedDate = nextDate;
          setWorkplaceContext({ date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
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

    root.querySelector('[data-day-workplaces-open]')?.addEventListener('click', openDayWorkplaces);
    root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplace);
    initViewNavigation(root, { views, activeView, onChange: (nextView) => { activeView = nextView; renderView(); } });
  };
  renderView();
}
