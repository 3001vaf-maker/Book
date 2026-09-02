export function initMultiSelect(root, { selectedDates = [], onChange = () => {} } = {}) {
  const selection = new Set(selectedDates);

  const sync = () => {
    root.querySelectorAll('[data-calendar-date]').forEach((button) => {
      const key = button.dataset.calendarDate || '';
      const selected = selection.has(key);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  const toggle = (dateKey) => {
    if (!dateKey) return;
    const button = Array.from(root.querySelectorAll('[data-calendar-date]')).find((item) => item.dataset.calendarDate === dateKey);
    if (!button) return;

    if (selection.has(dateKey)) selection.delete(dateKey);
    else selection.add(dateKey);

    sync();
    onChange([...selection]);
  };

  const handleClick = (event) => {
    const button = event.target.closest('[data-calendar-date]');
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    toggle(button.dataset.calendarDate || '');
  };

  root.addEventListener('click', handleClick, true);

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });

  sync();

  return {
    getSelectedDates: () => [...selection],
    isSelected: (dateKey) => selection.has(dateKey),
    setSelectedDates: (values = []) => {
      selection.clear();
      values.filter(Boolean).forEach((value) => selection.add(value));
      sync();
      onChange([...selection]);
    },
    toggle,
    destroy: () => {
      observer.disconnect();
      root.removeEventListener('click', handleClick, true);
    },
  };
}
