import { actionBlock, button, emptyState, pageHeader } from '../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Материалы')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}`;
  
}
