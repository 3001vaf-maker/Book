export function viewNavigation({ views, activeView }) {
  return `<div class="segment-control" role="tablist" aria-label="Представление" data-view-navigation>${views.map(({ id, label }) => `<button type="button" role="tab" aria-selected="${id === activeView}" class="${id === activeView ? 'is-active' : ''}" data-view="${id}">${label}</button>`).join('')}</div>`;
}

export function initViewNavigation(root, { views, activeView, onChange }) {
  const navigation = root.querySelector('[data-view-navigation]');
  if (!navigation) return;

  navigation.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view;
      if (!views.some(({ id }) => id === nextView) || nextView === activeView) return;
      onChange(nextView);
    });
  });
}
