import { pageHeader, viewNavigation, initViewNavigation, workplaceHeaderButton, getWorkplaceContext, setWorkplaceContext, select, modal, mountModal, timePicker, initTimePickers } from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { getDays, saveDays, getDay, getDayTime, updateDayTime, hasScheduleConflict } from '../core/day.js';
import { renderJournalDay } from './день.js';
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

  const renderHeaderControl = () => workplaceHeaderButton({ workplace: workplaces.find((item) => item.key === selectedWorkplaceId) || null });

  const openWorkplacePickerModal = () => {
    const options = workplaces.map((workplace) => ({ value: workplace.key, label: workplace.name || 'Без названия' }));
    const content = `<div class="modal-title"><h2>Выбрать место работы</h2></div>${select({ name: 'journalWorkplaceModal', label: 'Место работы', value: selectedWorkplaceId, options, data: 'data-journal-workplace-modal' })}<button type="button" class="ui-button" data-journal-workplace-save>Выбрать</button>`;
    const m = mountModal(document.body, modal(content, { title: 'Выбрать место работы' }));
    m?.querySelector('[data-journal-workplace-save]')?.addEventListener('click', () => { selectedWorkplaceId = m.querySelector('[data-journal-workplace-modal]')?.value || selectedWorkplaceId; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate }); m.remove(); renderView(); });
  };

  const openWorkplaceTimeModal = () => {
    const days = getDays(); const date = dateKey(selectedDate); const day = getDay(days, selectedWorkplaceId, date); const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    if (!day || !workplace) return;
    const current = getDayTime(day, workplaces); const from = current?.from || workplace.from || '09:00'; const to = current?.to || workplace.to || '18:00';
    const content = `<div class="modal-title"><h2>Время работы</h2></div><div class="timetable-time-fields">${timePicker({ name: 'journalWorkplaceFrom', label: 'Начало', value: from })}${timePicker({ name: 'journalWorkplaceTo', label: 'Окончание', value: to })}</div><div class="form-error" data-journal-workplace-time-error></div><button type="button" class="ui-button" data-journal-workplace-time-save>Сохранить</button>`;
    const m = mountModal(document.body, modal(content, { title: 'Время работы' })); if (!m) return; initTimePickers(m);
    m.querySelector('[data-journal-workplace-time-save]')?.addEventListener('click', () => {
      const fromNext = m.querySelector('[name="journalWorkplaceFrom"]')?.value || from; const toNext = m.querySelector('[name="journalWorkplaceTo"]')?.value || to;
      if (hasScheduleConflict(days, { workplaceId: selectedWorkplaceId, date, from: fromNext, to: toNext })) { m.querySelector('[data-journal-workplace-time-error]').textContent = 'Это время пересекается с другой работой мастера. Выберите другое время.'; return; }
      if (!updateDayTime(days, selectedWorkplaceId, date, fromNext, toNext)) { m.querySelector('[data-journal-workplace-time-error]').textContent = 'Проверьте рабочее время.'; return; }
      saveDays(days); m.remove(); renderView();
    });
  };

  const openWorkplaceModal = () => {
    const days = getDays(); const date = dateKey(selectedDate); const hasWorkingDay = Boolean(getDay(days, selectedWorkplaceId, date)); const workplace = workplaces.find((item) => item.key === selectedWorkplaceId) || null;
    const content = `<div class="modal-title"><h2>Место работы</h2></div><div class="timetable-workplace-modal-summary"><strong>${workplace?.name || 'Место работы не выбрано'}</strong></div><div class="timetable-workplace-modal-actions"><button type="button" class="ui-button" data-journal-open-picker>Выбрать место работы</button><button type="button" class="ui-button" data-journal-open-time ${hasWorkingDay ? '' : 'disabled'}>Скорректировать время</button></div>`;
    const m = mountModal(document.body, modal(content, { title: 'Место работы' }));
    m?.querySelector('[data-journal-open-picker]')?.addEventListener('click', () => { m.remove(); openWorkplacePickerModal(); });
    m?.querySelector('[data-journal-open-time]')?.addEventListener('click', () => { if (hasWorkingDay) { m.remove(); openWorkplaceTimeModal(); } });
  };

  const renderView = () => {
    root.innerHTML = `${pageHeader('Журнал', '', renderHeaderControl())}${viewNavigation({ views, activeView })}<div data-journal-view></div>`;
    const viewRoot = root.querySelector('[data-journal-view]');
    if (activeView === 'day') renderJournalDay(viewRoot, { date: selectedDate, workplaceId: selectedWorkplaceId, onChange: (nextDate) => { selectedDate = nextDate; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate }); renderView(); } });
    else if (activeView === 'month') renderJournalMonth(viewRoot, { workplaceId: selectedWorkplaceId, onDateSelect: (nextDate) => { selectedDate = nextDate; setWorkplaceContext({ workplaceId: selectedWorkplaceId, date: selectedDate }); activeView = 'day'; renderView(); } });
    else renderJournalList(viewRoot);
    root.querySelector('[data-workplace-header-open]')?.addEventListener('click', openWorkplaceModal);
    initViewNavigation(root, { views, activeView, onChange: (nextView) => { activeView = nextView; renderView(); } });
  };
  renderView();
}
