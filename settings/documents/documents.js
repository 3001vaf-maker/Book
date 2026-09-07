import { actionBlock, button, emptyState, pageHeader } from '../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Документы')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' }))}`;
  root.querySelector('[data-documents-back]')?.addEventListener('click', navigateBack);
}
