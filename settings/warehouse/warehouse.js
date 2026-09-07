import { actionBlock, button, folderCard, pageHeader } from '../../ui/ui.js';

const children = [['recipes', 'Рецепты', '◫'], ['materials', 'Материалы', '◫']];

function renderWarehouseFolders(root, navigateBack) {
  root.innerHTML = `${pageHeader('Склад')}<div class="ui-folder-grid">${children.map(([key, label, icon]) => folderCard({ title: label, icon, data: `data-warehouse-open="${key}"` })).join('')}</div>${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-warehouse-back' }))}`;
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
