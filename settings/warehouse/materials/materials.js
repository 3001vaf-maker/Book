import { emptyState, pageHeader } from '../../../ui/ui.js';

export function render(root) {
  root.innerHTML = `${pageHeader('Материалы')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}`;
}
