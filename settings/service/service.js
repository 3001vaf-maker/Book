import { actionBlock, button, folderList, pageHeader } from '../../ui/ui.js';

const children = [
  ['procedures', 'Процедуры', () => import('./procedures/procedures.js?v=shared-duration-text-20260907')],
  ['products', 'Товары', () => import('./products/products.js?v=shared-render-contract-20260907')],
];

export function renderService(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Сервис')}${folderList(children.map(([key, label]) => ({ title: label, data: `data-service-open="${key}"` })))}${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-service-back' }))}`;
  root.querySelectorAll('[data-service-open]').forEach((element) => {
    element.addEventListener('click', async () => {
      const folder = children.find(([key]) => key === element.dataset.serviceOpen);
      if (!folder) return;
      const { render } = await folder[2]();
      render(root, () => renderService(root, navigateBack));
    });
  });
  root.querySelector('[data-service-back]')?.addEventListener('click', navigateBack);
}

export { renderService as render };
