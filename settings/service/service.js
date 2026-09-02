import { button, escapeHtml, pageHeader } from '../../ui/ui.js';

const children = [
  ['procedures', 'Процедуры'],
  ['products', 'Товары'],
];

export function renderService(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Сервис')}<div class="settings-list">${children.map(([key, label]) => `<button class="settings-row" type="button" data-service-open="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><span>›</span></button>`).join('')}</div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-service-back' })}</div>`;
  root.querySelectorAll('[data-service-open]').forEach((element) => {
    element.addEventListener('click', async () => {
      if (element.dataset.serviceOpen === 'procedures') {
        const { renderProcedures } = await import('./procedures/procedures.js');
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
