import { button, escapeHtml, pageHeader } from '../../ui/ui.js';

const children = [['recipes', 'Рецепты'], ['materials', 'Материалы']];

function renderWarehouseFolders(root, navigateBack) {
  root.innerHTML = `${pageHeader('Склад')}<div class="settings-list">${children.map(([key, label]) => `<button class="settings-row" type="button" data-warehouse-open="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><span>›</span></button>`).join('')}</div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-warehouse-back' })}</div>`;
  root.querySelectorAll('[data-warehouse-open]').forEach((element) => element.addEventListener('click', async () => {
    const key = element.dataset.warehouseOpen;
    if (key === 'recipes') {
      const { render } = await import('./recipes/recipes.js');
      render(root, () => renderWarehouseFolders(root, navigateBack));
    } else if (key === 'materials') {
      const { render } = await import('./materials/materials.js');
      render(root, () => renderWarehouseFolders(root, navigateBack));
    }
  }));
  root.querySelector('[data-warehouse-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  renderWarehouseFolders(root, navigateBack);
}
