import { actionBlock, button, folderList, pageHeader } from '../../ui/ui.js';

const children = [
  ['procedures', 'Процедуры', '◫'],
  ['products', 'Товары', '◫'],
];

export function renderService(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Сервис')}${folderList(children.map(([key, label]) => ({ title: label, data: `data-service-open="${key}"` })))}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-service-back' }))}`;
  root.querySelectorAll('[data-service-open]').forEach((element) => {
    element.addEventListener('click', async () => {
      if (element.dataset.serviceOpen === 'procedures') {
        const { renderProcedures } = await import('./procedures/procedures.js?v=description-workplace-wording-20260907');
        renderProcedures(root, () => renderService(root, navigateBack));
      } else if (element.dataset.serviceOpen === 'products') {
        const { renderProducts } = await import('./products/products.js');
        renderProducts(root, () => renderService(root, navigateBack));
      }
    });
  });
  root.querySelector('[data-service-back]')?.addEventListener('click', navigateBack);
}

export { renderService as render };
