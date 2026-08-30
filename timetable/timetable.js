import { pageHeader, emptyState } from '../ui/ui.js';
export function renderTimetable(root) { root.innerHTML = `${pageHeader('График')}${emptyState('График пока пуст','Рабочее время будет добавлено отдельным ТЗ.')}`; }
