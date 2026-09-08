import { openHeaderControl, list, button, openDayWorkplaceControl, escapeHtml, ALL_WORKPLACES_ID } from '../ui/ui.js?v=journal-header-split-20260908';

const WORKPLACE_FALLBACK_COLOR = '#212529';

function recordCountText(count = 0) {
  return `${Math.max(0, Number(count) || 0)} з`;
}

/**
 * Journal-owned Header manifestation.
 * Journal decides that its aggregate row means "Все записи".
 * It reuses shared Header Control + List, but does not use Graph's Workplace control.
 */
export function openJournalWorkplaceControl({
  workplaces = [],
  workplaceId = '',
  recordCounts = {},
  available = [],
  onSelect = () => {},
  onAdd = () => {},
} = {}) {
  const items = [{
    title: 'Все записи',
    interactive: true,
    selected: workplaceId === ALL_WORKPLACES_ID,
    data: `data-journal-workplace-select="${ALL_WORKPLACES_ID}"`,
    aria: 'Показать записи всех рабочих мест',
  }];

  for (const workplace of Array.isArray(workplaces) ? workplaces : []) {
    const key = String(workplace?.key || '');
    if (!key) continue;
    items.push({
      title: workplace?.name || 'Без названия',
      right: [recordCountText(recordCounts?.[key])],
      indicatorColor: workplace?.indicatorColor || workplace?.color || WORKPLACE_FALLBACK_COLOR,
      indicatorLabel: workplace?.name || 'Рабочее место',
      interactive: true,
      selected: key === String(workplaceId || ''),
      data: `data-journal-workplace-select="${escapeHtml(key)}"`,
      aria: `Показать записи рабочего места ${workplace?.name || ''}`,
    });
  }

  const addAction = Array.isArray(available) && available.length
    ? `<div class="workplace-control-actions">${button('+ Добавить рабочее место', { variant: 'secondary', data: 'data-journal-workplace-add' })}</div>`
    : '';
  const content = `<div class="workplace-control-list">${list({ items })}</div>${addAction}`;
  const main = openHeaderControl(content, { title: '' });
  main?.querySelectorAll('[data-journal-workplace-select]').forEach((row) => row.addEventListener('click', () => {
    const nextId = String(row.dataset.journalWorkplaceSelect || '');
    if (!nextId) return;
    main.remove();
    onSelect(nextId);
  }));
  main?.querySelector('[data-journal-workplace-add]')?.addEventListener('click', () => {
    main.remove();
    openDayWorkplaceControl({
      active: [],
      available,
      catalogTitle: 'Добавить рабочее место',
      onAdd,
    });
  });
  return main;
}
