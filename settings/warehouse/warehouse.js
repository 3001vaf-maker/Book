import { button, escapeHtml, pageHeader } from '../../ui/ui.js';

const children = [['recipes', 'Рецепты'], ['materials', 'Материалы']];

function renderWarehouseFolders(root, navigateBack) {
  root.innerHTML = `${pageHeader('Склад')}<div class="settings-list">${children.map(([key, label]) => `<button class="settings-row" type="button" data-warehouse-open="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><span>›</span></button>`).join('')}</div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-warehouse-back' })}</div>`;
  root.querySelectorAll('[data-warehouse-open]').forEach((element) => element.addEventListener('click', () => {
    const label = children.find(([key]) => key === element.dataset.warehouseOpen)?.[1];
    if (!label) return;
    root.innerHTML = `${pageHeader(label)}<div class="empty-state"><strong>Раздел подготовлен</strong><span>Содержимое добавляется отдельным ТЗ.</span></div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-warehouse-child-back' })}</div>`;
    root.querySelector('[data-warehouse-child-back]')?.addEventListener('click', () => renderWarehouseFolders(root, navigateBack));
  }));
  root.querySelector('[data-warehouse-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  renderWarehouseFolders(root, navigateBack);
}
