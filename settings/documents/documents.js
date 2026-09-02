import { button, pageHeader } from '../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Документы')}<div class="empty-state"><strong>Раздел подготовлен</strong><span>Содержимое добавляется отдельным ТЗ.</span></div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-documents-back' })}</div>`;
  root.querySelector('[data-documents-back]')?.addEventListener('click', navigateBack);
}
