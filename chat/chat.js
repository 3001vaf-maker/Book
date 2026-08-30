import { pageHeader, emptyState } from '../ui/ui.js';
export function renderChat(root) { root.innerHTML = `${pageHeader('Чат')}${emptyState('Чат пока пуст','Содержимое этой ветки будет добавлено отдельным ТЗ.')}`; }
