import { actionBlock, button, folderList, pageHeader } from '../../ui/ui.js';

const children = [['recipes', 'Рецепты', '◫'], ['materials', 'Материалы', '◫']];

function renderWarehouseFolders(root, navigateBack) {
  root.innerHTML = `${pageHeader('Склад')}${folderList(children.map(([key, label]) => ({ title: label, data: `data-warehouse-open="${key}"` })))}`;
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
  
}

export function render(root, navigateBack = () => {}) {
  renderWarehouseFolders(root, navigateBack);
}
