import { escapeHtml } from '../utils/escape-html.js';

export function viewNavigation({ views = [], activeView = '', className = '', ariaLabel = 'Представление' } = {}) {
  const countClass = views.length === 1 ? 'segment-control--one' : views.length === 2 ? 'segment-control--two-equal' : '';
  const classes = ['segment-control', countClass, className].filter(Boolean).join(' ');
  return `<div class="${escapeHtml(classes)}" role="tablist" aria-label="${escapeHtml(ariaLabel)}" data-view-navigation>${views.map(({ id, label }) => `<button type="button" role="tab" aria-selected="${id === activeView}" class="${id === activeView ? 'is-active' : ''}" data-view="${escapeHtml(id)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

export function initViewNavigation(root, { views, activeView, onChange }) {
  const navigation = root.querySelector('[data-view-navigation]');
  if (!navigation) return;
  let currentView = activeView;

  navigation.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view;
      if (!views.some(({ id }) => id === nextView) || nextView === currentView) return;
      currentView = nextView;
      navigation.querySelectorAll('[data-view]').forEach((item) => {
        const isActive = item.dataset.view === currentView;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
      onChange(nextView);
    });
  });
}
