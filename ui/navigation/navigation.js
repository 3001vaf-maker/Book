const defaultItems = [
  { id: 'main', label: 'Главная', icon: '⌂' },
  { id: 'timetable', label: 'График', icon: '◷' },
  { id: 'journal', label: 'Журнал', icon: '▤' },
  { id: 'chat', label: 'Чат', icon: '◌' },
  { id: 'settings', label: 'Настройки', icon: '⚙' },
];

export function navigationBar(items = [], active = '', { className = '', aria = 'Основная навигация', dataAttribute = 'data-nav' } = {}) {
  const values = (Array.isArray(items) ? items : []).filter((item) => item && item.id);
  const classes = ['bottom-nav', className].filter(Boolean).join(' ');
  return `<nav class="${classes}" aria-label="${aria}">${values.map((item) => {
    if (item.hidden) return '<span class="nav-item nav-item--empty" aria-hidden="true"></span>';
    const id = String(item.id || '');
    const label = String(item.label || id);
    const icon = String(item.icon || '');
    return `<button type="button" class="nav-item ${String(active) === id ? 'is-active' : ''}" ${dataAttribute}="${id}"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-label">${label}</span></button>`;
  }).join('')}</nav>`;
}

export function bottomNavigation(active, allowedIds = null) {
  const allowed = Array.isArray(allowedIds) ? new Set(allowedIds) : null;
  const items = allowed ? defaultItems.map((item) => allowed.has(item.id) ? item : { ...item, hidden: true }) : defaultItems;
  return navigationBar(items, active);
}
