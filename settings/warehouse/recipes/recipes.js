import { emptyState, pageHeader } from '../../../ui/ui.js';

export function render(root) {
  root.innerHTML = `${pageHeader('Рецепты')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}`;
}
