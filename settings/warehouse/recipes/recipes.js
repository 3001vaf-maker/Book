import { button, emptyState, pageHeader } from '../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Рецепты')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}<div class="profile-actions">${button('Назад',{className:'ui-button--secondary',data:'data-recipes-back'})}</div>`;
  root.querySelector('[data-recipes-back]')?.addEventListener('click', navigateBack);
}
