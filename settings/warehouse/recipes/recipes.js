import { actionBlock, button, emptyState, pageHeader } from '../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Рецепты')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}${actionBlock(button('Назад',{className:'ui-button--secondary',data:'data-recipes-back'}))}`;
  root.querySelector('[data-recipes-back]')?.addEventListener('click', navigateBack);
}
