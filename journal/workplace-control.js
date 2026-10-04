import { ALL_WORKPLACES_ID, modal, mountModal, v2ListEntries, v2ListEntry } from '../ui/ui.js';

const WORKPLACE_FALLBACK_COLOR = '#212529';

function recordCountText(count = 0) {
  return `${Math.max(0, Number(count) || 0)} записей`;
}

function workplaceMeta(workplace = {}, count = 0) {
  const range = workplace?.from && workplace?.to ? `${workplace.from} - ${workplace.to}` : '';
  return [range, recordCountText(count)].filter(Boolean).join(' · ');
}

function closeExistingJournalWorkplaceControl() {
  document.querySelectorAll('[data-journal-workplace-control]').forEach((surface) => {
    const layer = surface.closest('[data-modal]');
    if (layer?.v2Close) layer.v2Close();
    else layer?.remove?.();
  });
}

/**
 * Journal workplace switcher.
 * One compact bottom X only: no nested select modal, so repeated taps cannot
 * leave stacked modal locks over the Journal stage.
 */
export function openJournalWorkplaceControl({
  workplaces = [],
  workplaceId = '',
  recordCounts = {},
  aggregateCount = 0,
  onSelect = () => {},
} = {}) {
  closeExistingJournalWorkplaceControl();

  const currentId = String(workplaceId || ALL_WORKPLACES_ID);
  const entries = [
    v2ListEntry({
      title: 'График дня',
      subtitle: recordCountText(aggregateCount),
      interactive: true,
      selected: currentId === ALL_WORKPLACES_ID,
      data: `data-journal-workplace-pick="${ALL_WORKPLACES_ID}"`,
      aria: 'Показать общий график дня',
    }),
    ...(Array.isArray(workplaces) ? workplaces : []).map((workplace) => {
      const key = String(workplace?.key || workplace?.workplaceId || '');
      if (!key) return '';
      return v2ListEntry({
        title: workplace?.name || 'Без названия',
        subtitle: workplaceMeta(workplace, recordCounts?.[key]),
        leadingSwatch: workplace?.indicatorColor || workplace?.color || WORKPLACE_FALLBACK_COLOR,
        interactive: true,
        selected: currentId === key,
        data: `data-journal-workplace-pick="${key}"`,
        aria: `Показать ${workplace?.name || 'рабочее пространство'}`,
      });
    }).filter(Boolean),
  ];

  const main = mountModal(document.body, modal(
    `<div data-journal-workplace-control>${v2ListEntries(entries)}</div>`,
    { variant: 'x', surface: 'app', title: 'Рабочее пространство' },
  ));
  if (!main) return null;

  main.querySelectorAll('[data-journal-workplace-pick]').forEach((row) => {
    row.addEventListener('click', () => {
      const nextId = String(row.dataset.journalWorkplacePick || '');
      if (!nextId) return;
      main.v2Close?.();
      if (nextId === currentId) return;
      onSelect(nextId);
    });
  });
  return main;
}
