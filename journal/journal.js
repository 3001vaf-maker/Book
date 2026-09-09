import { pageHeader, viewNavigation, initViewNavigation, headerControl, headerToggle, headerControlGroup, workplaceContent, ALL_WORKPLACES_ID, openDayWorkplaceTime } from '../ui/ui.js';
import { getWorkplaceContext, setWorkplaceContext } from '../core/workplace-context.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getActiveDayWorkplaces, getAvailableDayWorkplaces, getDayWorkplaceDraft, saveDayWorkplaceTime } from '../core/day-workplaces.js';
import { paymentTotal } from '../core/payment.js';
import { getActiveRecordCountForDay, getRecordsForDay } from './record-data.js';
import { openJournalWorkplaceControl } from './workplace-control.js';
import { renderJournalDay } from './день.js';
import { renderJournalMonth } from './месяц.js';
import { renderJournalList } from './список.js';

const JOURNAL_CONTEXT_SCOPE = 'journal';

const views = [
  { id: 'day', label: 'День', render: renderJournalDay },
  { id: 'month', label: 'Месяц', render: renderJournalMonth },
  { id: 'list', label: 'Список', render: renderJournalList },
];

const listModes = [
  { id: 'flow', label: 'Поток' },
  { id: 'time', label: 'По времени' },
];

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatRubles(value = 0) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  return `${amount.toLocaleString('ru-RU').replaceAll('\u00a0', ' ')} р.`;
}

export function renderJournal(root) {
  let activeView = 'day';
  let listMode = 'flow';
  const workplaces = getWorkplaces();
  const context = getWorkplaceContext(workplaces, { scope: JOURNAL_CONTEXT_SCOPE });
  let selectedWorkplaceId = context.workplaceId;
  let selectedDate = context.date;

  const activeDayWorkplaces = () => getActiveDayWorkplaces(selectedDate, workplaces);

  const dayHeaderSummary = () => {
    const day = dateKey(selectedDate);
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const records = getRecordsForDay(day, allMode ? '' : selectedWorkplaceId)
      .filter((record) => record?.status !== 'cancelled');
    const recordCount = records.length;
    const procedureCount = records.reduce((sum, record) => sum + (Array.isArray(record?.procedures) ? record.procedures.length : 0), 0);
    const total = records.reduce((sum, record) => sum + paymentTotal(record?.procedures || []), 0);
    return {
      primaryText: `${recordCount} зап. - ${procedureCount}пр.`,
      secondaryText: formatRubles(total),
    };
  };

  const renderHeaderControl = () => {
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const workplace = allMode ? null : workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const summary = activeView === 'day' ? dayHeaderSummary() : {};
    return headerControl(workplaceContent({
      workplace,
      title: allMode ? 'Все записи' : '',
      ...summary,
    }), {
      data: 'data-workplace-header-open',
      aria: allMode ? 'Все записи по рабочим местам' : `Рабочее место: ${workplace?.name || 'не выбрано'}`,
    });
  };

  const renderHeaderMeta = () => {
    const workplaceControl = renderHeaderControl();
    if (activeView !== 'list') return workplaceControl;
    return headerControlGroup([
      headerToggle({ items: listModes, activeId: listMode, data: 'data-journal-list-mode' }),
      workplaceControl,
    ]);
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
    root.innerHTML = `${pageHeader('Журнал', '', renderHeaderMeta())}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
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
    } else renderJournalList(viewRoot, { mode: listMode });

    root.querySelector('[data-workplace-header-open]')?.addEventListener('click', activeView === 'day' ? openDayWorkplaces : openWorkplace);
    root.querySelectorAll('[data-journal-list-mode]').forEach((node) => node.addEventListener('click', () => {
      const nextMode = node.dataset.journalListMode;
      if (!listModes.some((item) => item.id === nextMode) || nextMode === listMode) return;
      listMode = nextMode;
      renderView();
    }));
    initViewNavigation(root, { views, activeView, onChange: (nextView) => { activeView = nextView; renderView(); } });
  };

  if (root.__bookJournalRecordsChangedHandler) window.removeEventListener('book:records-changed', root.__bookJournalRecordsChangedHandler);
  root.__bookJournalRecordsChangedHandler = () => {
    if (activeView === 'day' || activeView === 'list') renderView();
  };
  window.addEventListener('book:records-changed', root.__bookJournalRecordsChangedHandler);

  if (root.__bookJournalPaymentsChangedHandler) window.removeEventListener('book:payments-changed', root.__bookJournalPaymentsChangedHandler);
  root.__bookJournalPaymentsChangedHandler = () => {
    if (activeView === 'list') renderView();
  };
  window.addEventListener('book:payments-changed', root.__bookJournalPaymentsChangedHandler);

  renderView();
}
