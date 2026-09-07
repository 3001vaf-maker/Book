import { button, emptyState, pageHeader } from '../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Материалы')}${emptyState('Раздел подготовлен','Содержимое добавляется отдельным ТЗ.')}<div class="profile-actions">${button('Назад',{className:'ui-button--secondary',data:'data-materials-back'})}</div>`;
  root.querySelector('[data-materials-back]')?.addEventListener('click', navigateBack);
}
