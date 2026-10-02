import { viewNavigation, initViewNavigation, ALL_WORKPLACES_ID, modal, mountModal, openSharedProfileSettingsMenu, workspaceHeaderContext } from '../ui/ui.js';
import { getWorkplaceContext, setWorkplaceContext } from '../core/workplace-context.js';
import { readOnlyReceipt } from '../ui/receipt/index.js';
import { canUseBookCapability } from '../core/access.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getActiveDayWorkplaces } from '../core/day/index.js';
import { getRecordPaymentState, recordAmountDue } from '../core/finance/index.js';
import { makeTimetableDayOff, openTimetableDayEditor } from '../timetable/day-editor.js';
import { getActiveRecordCountForDay, getRecordsForDay } from '../core/record/index.js';
import { openJournalWorkplaceControl } from './workplace-control.js';
import { renderJournalDay } from './день.js';
import { renderJournalMonth } from './месяц.js';
import { renderJournalList } from './список.js';

const JOURNAL_CONTEXT_SCOPE = 'journal';

const views = [
  { id: 'day', label: 'День', render: renderJournalDay, capability: 'journal.day.access' },
  { id: 'month', label: 'Месяц', render: renderJournalMonth, capability: 'journal.month.access' },
  { id: 'list', label: 'Список', render: renderJournalList, capability: 'journal.list.access' },
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

export function journalNavigationItems() {
  return views
    .filter((view) => canUseBookCapability(view.capability))
    .map(({ id, label }) => ({ id, label }));
}

export function renderJournal(root, options = {}) {
  const availableViews = views.filter((view) => canUseBookCapability(view.capability));
  let activeView = availableViews.some((view) => view.id === options.initialView)
    ? options.initialView
    : (availableViews[0]?.id || 'day');
  const externalNavigation = Boolean(options.externalNavigation);
  let listMode = 'flow';
  const workplaces = getWorkplaces();
  const context = getWorkplaceContext(workplaces, { scope: JOURNAL_CONTEXT_SCOPE });
  let selectedWorkplaceId = context.workplaceId;
  let selectedDate = context.date;

  const activeDayWorkplaces = () => getActiveDayWorkplaces(selectedDate, workplaces);

  const openDayTime = (workplaceId = '') => {
    openTimetableDayEditor({
      date: selectedDate,
      focusWorkplaceId: workplaceId,
      onSave: () => {
        setWorkplaceContext({ date: selectedDate, scope: JOURNAL_CONTEXT_SCOPE });
        renderView();
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

    openJournalWorkplaceControl({
      workplaces: active,
      workplaceId: selectedWorkplaceId,
      recordCounts,
      aggregateCount: getActiveRecordCountForDay(day),
      onSelect: selectWorkplace,
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
      aggregateCount: getActiveRecordCountForDay(day),
      onSelect: selectWorkplace,
    });
  };

  const journalTitle = () => {
    if (selectedWorkplaceId === ALL_WORKPLACES_ID) return 'Журнал';
    return workplaces.find((item) => String(item?.key || '') === String(selectedWorkplaceId || ''))?.name || 'Журнал';
  };

  const openDayZReport = () => {
    const day = dateKey(selectedDate);
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const records = getRecordsForDay(day, allMode ? '' : selectedWorkplaceId)
      .filter((record) => record?.status !== 'cancelled');
    const procedureCount = records.reduce((sum, record) => sum + (Array.isArray(record?.procedures) ? record.procedures.length : 0), 0);
    const total = records.reduce((sum, record) => sum + recordAmountDue(record), 0);
    const average = records.length ? total / records.length : 0;
    const dateLabel = selectedDate.toLocaleDateString('ru-RU');
    const workplaceLabel = allMode ? 'Все пространства' : journalTitle();
    const groups = [
      [
        { label: workplaceLabel, value: dateLabel },
        { label: 'Кол-во записей:', value: String(records.length) },
        { label: 'Кол-во процедур:', value: String(procedureCount) },
        { label: 'Сумма:', value: formatRubles(total) },
        { label: 'Средний чек:', value: formatRubles(average) },
      ],
      ...records.map((record) => {
        const person = record?.person || {};
        const fullName = [person?.name, person?.surname].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
        const identity = [person?.uei, fullName].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
        const payment = getRecordPaymentState(record);
        const status = payment.fullyPaid ? 'оплачено' : payment.partiallyPaid ? 'задолженность' : 'к оплате';
        return [
          { label: identity || 'Запись', value: formatRubles(recordAmountDue(record)) },
          { label: 'Статус', value: status },
        ];
      }),
    ];
    mountModal(document.body, modal(readOnlyReceipt({
      title: 'Z - Отчет',
      groups,
    }), { variant: 'top', surface: 'app', title: 'Z - Отчет' }));
  };

  const makeSelectedDayOff = () => {
    if (selectedWorkplaceId === ALL_WORKPLACES_ID) return;
    const day = dateKey(selectedDate);
    if (getActiveRecordCountForDay(day, selectedWorkplaceId) > 0) return;
    makeTimetableDayOff({
      date: selectedDate,
      workplaceId: selectedWorkplaceId,
      onSave: renderView,
    });
  };

  const openJournalSettings = () => {
    const day = dateKey(selectedDate);
    const allMode = selectedWorkplaceId === ALL_WORKPLACES_ID;
    const canMakeDayOff = activeView === 'day'
      && !allMode
      && getActiveRecordCountForDay(day, selectedWorkplaceId) === 0;
    openSharedProfileSettingsMenu({
      title: 'Настройки журнала',
      actions: [
        {
          id: 'workplace',
          label: 'Рабочее пространство',
          onSelect: activeView === 'day' ? openDayWorkplaces : openWorkplace,
        },
        activeView === 'day' ? {
          id: 'z-report',
          label: 'Z-Отчет',
          onSelect: openDayZReport,
        } : null,
        canMakeDayOff ? {
          id: 'day-off',
          label: 'Сделать выходным',
          variant: 'danger',
          onSelect: makeSelectedDayOff,
        } : null,
      ].filter(Boolean),
    });
  };

  const renderView = () => {
    if (!root.isConnected) return;
    const listModeNavigation = activeView === 'list'
      ? `<div class="journal-list-mode-navigation" data-journal-list-mode-navigation>${viewNavigation({ views: listModes, activeView: listMode, className: 'segment-control--two-equal', ariaLabel: 'Режим списка' })}</div>`
      : '';
    const viewClass = activeView === 'list' ? ' class="journal-list-viewport"' : '';
    const primaryNavigation = externalNavigation ? '' : viewNavigation({ views: availableViews, activeView });
    root.innerHTML = `${workspaceHeaderContext({
      title: activeView === 'day' ? journalTitle() : 'Журнал',
      a: {
        kind: 'settings',
        label: 'Настройки журнала',
        data: 'data-journal-settings',
        aria: 'Настройки журнала',
      },
    })}${primaryNavigation}${listModeNavigation}<div data-journal-view${viewClass}></div>`;
    const viewRoot = root.querySelector('[data-journal-view]');
    if (activeView === 'day') {
      renderJournalDay(viewRoot, {
        date: selectedDate,
        workplaceId: selectedWorkplaceId,
        onWorkplaceFieldClick: openDayTime,
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
          options.onViewChange?.(activeView);
          renderView();
        },
      });
    } else renderJournalList(viewRoot, { mode: listMode, workplaceId: selectedWorkplaceId });

    root.querySelector('[data-journal-settings]')?.addEventListener('click', openJournalSettings);
    const listModeRoot = root.querySelector('[data-journal-list-mode-navigation]');
    if (listModeRoot) {
      initViewNavigation(listModeRoot, {
        views: listModes,
        activeView: listMode,
        onChange: (nextMode) => {
          listMode = nextMode;
          renderView();
        },
      });
    }
    if (!externalNavigation) {
      initViewNavigation(root, { views, activeView, onChange: (nextView) => {
        activeView = nextView;
        options.onViewChange?.(activeView);
        renderView();
      } });
    }
  };

  let refreshQueued = false;
  const scheduleRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      renderView();
    });
  };
  const refreshEvents = [
    'book:records-changed',
    'book:dds-changed',
    'book:time-usage-changed',
    'book:people-changed',
    'book:procedures-changed',
    'book:products-changed',
    'book:workplaces-changed',
  ];
  refreshEvents.forEach((eventName) => window.addEventListener(eventName, scheduleRefresh));
  renderView();

  return () => {
    refreshEvents.forEach((eventName) => window.removeEventListener(eventName, scheduleRefresh));
  };
}

export function renderJournalView(root, view = 'day', options = {}) {
  return renderJournal(root, { ...options, initialView: view, externalNavigation: true });
}
