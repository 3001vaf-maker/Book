import { pageHeader, viewNavigation, initViewNavigation, workplaceHeaderButton, select, modal, mountModal, timePicker, initTimePickers } from '../ui/ui.js?v=journal-workplace-header-20260903';
import { getWorkplaces, resolveWorkplaceTime, resolveWorkingDayTime } from '../core/workplace-time.js?v=journal-workplace-header-20260903';
import { getTimeWorks, saveTimeWorks, ensureTimeWork, correctTimeWork } from '../core/time-work.js?v=journal-workplace-header-20260903';
import { renderJournalDay } from './день.js?v=journal-worktime-20260903';
import { renderJournalMonth } from './месяц.js?v=journal-worktime-20260903';
import { renderJournalList } from './список.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';

function loadWorkingDays() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return Array.isArray(parsed.workingDays) ? parsed.workingDays : [];
  } catch {
    return [];
  }
}

const views = [
  { id: 'day', label: 'День', render: renderJournalDay },
  { id: 'month', label: 'Месяц', render: renderJournalMonth },
  { id: 'list', label: 'Список', render: renderJournalList },
];

export function renderJournal(root) {
  let activeView = 'day';
  const workplaces = getWorkplaces();
  let selectedWorkplaceId = workplaces[0]?.key || '';
  let selectedDate = new Date();

  const renderHeaderControl = () => {
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    return workplaceHeaderButton({ workplace });
  };

  const openWorkplacePickerModal = () => {
    const options = workplaces.map((workplace) => ({ value: workplace.key, label: workplace.name || 'Без названия' }));
    const content = `<div class="modal-title"><h2>Выбрать место работы</h2></div>${select({ name: 'journalWorkplaceModal', label: 'Место работы', value: selectedWorkplaceId, options, data: 'data-journal-workplace-modal' })}<button type="button" class="ui-button" data-journal-workplace-save>Выбрать</button>`;
    const modalRoot = mountModal(document.body, modal(content, { title: 'Выбрать место работы' }));
    modalRoot?.querySelector('[data-journal-workplace-save]')?.addEventListener('click', () => {
      selectedWorkplaceId = modalRoot.querySelector('[data-journal-workplace-modal]')?.value || selectedWorkplaceId;
      modalRoot.remove();
      renderView();
    });
  };

  const openWorkplaceTimeModal = () => {
    const workingDays = loadWorkingDays();
    const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const workingDay = workingDays.find((item) => item?.workplaceId === selectedWorkplaceId && item?.date === date) || null;
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    if (!workingDay || !workplace) return;
    const timeWorks = getTimeWorks();
    const time = resolveWorkingDayTime(workplaces, workingDay, timeWorks);
    const from = time?.from || workplace.from || '09:00';
    const to = time?.to || workplace.to || '18:00';
    const content = `<div class="modal-title"><h2>Время работы</h2></div><div class="timetable-time-fields">${timePicker({ name: 'journalWorkplaceFrom', label: 'Начало', value: from })}${timePicker({ name: 'journalWorkplaceTo', label: 'Окончание', value: to })}</div><button type="button" class="ui-button" data-journal-workplace-time-save>Сохранить</button>`;
    const modalRoot = mountModal(document.body, modal(content, { title: 'Время работы' }));
    if (!modalRoot) return;
    initTimePickers(modalRoot);
    modalRoot.querySelector('[data-journal-workplace-time-save]')?.addEventListener('click', () => {
      const nextFrom = modalRoot.querySelector('[name="journalWorkplaceFrom"]')?.value || from;
      const nextTo = modalRoot.querySelector('[name="journalWorkplaceTo"]')?.value || to;
      const baseTime = resolveWorkplaceTime(workplaces, selectedWorkplaceId);
      if (!baseTime) return;
      const timeWork = ensureTimeWork(timeWorks, { workplaceId: selectedWorkplaceId, date, time: baseTime });
      if (!timeWork) return;
      correctTimeWork(timeWork, nextFrom, nextTo, 'journal');
      saveTimeWorks(timeWorks);
      modalRoot.remove();
      renderView();
    });
  };

  const openWorkplaceModal = () => {
    const workingDays = loadWorkingDays();
    const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const hasWorkingDay = workingDays.some((item) => item?.workplaceId === selectedWorkplaceId && item?.date === date);
    const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const content = `<div class="modal-title"><h2>Место работы</h2></div><div class="timetable-workplace-modal-summary"><strong>${workplace?.name || 'Место работы не выбрано'}</strong></div><div class="timetable-workplace-modal-actions"><button type="button" class="ui-button" data-journal-open-picker>Выбрать место работы</button><button type="button" class="ui-button" data-journal-open-time ${hasWorkingDay ? '' : 'disabled'}>Скорректировать время</button></div>`;
    const modalRoot = mountModal(document.body, modal(content, { title: 'Место работы' }));
    modalRoot?.querySelector('[data-journal-open-picker]')?.addEventListener('click', () => { modalRoot.remove(); openWorkplacePickerModal(); });
    modalRoot?.querySelector('[data-journal-open-time]')?.addEventListener('click', () => { if (!hasWorkingDay) return; modalRoot.remove(); openWorkplaceTimeModal(); });
  };

  const bindHeaderControl = () => root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplaceModal);

  const renderView = () => {
    const meta = activeView === 'day' ? renderHeaderControl() : '';
    root.innerHTML = `${pageHeader('Журнал', '', meta)}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
    const viewRoot = root.querySelector('[data-journal-view]');
    if (activeView === 'day') {
      renderJournalDay(viewRoot, {
        date: selectedDate,
        workplaceId: selectedWorkplaceId,
        onChange: (nextDate) => { selectedDate = nextDate; renderView(); },
      });
      bindHeaderControl();
    } else if (activeView === 'month') {
      renderJournalMonth(viewRoot, { workplaceId: selectedWorkplaceId });
    } else {
      renderJournalList(viewRoot);
    }
    initViewNavigation(root, {
      views,
      activeView,
      onChange: (nextView) => { activeView = nextView; renderView(); },
    });
  };

  renderView();
}
