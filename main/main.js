import { pageHeader } from '../ui/ui.js';

export function renderMain(root) {
  const count = JSON.parse(localStorage.getItem('book.people') || '[]').length;
  root.innerHTML = `${pageHeader('Главная')}<section class="main-grid"><button class="folder-card folder-card--large" type="button" data-open-clients><span class="folder-card__top"><span class="folder-icon">◫</span><span class="counter">${count}</span></span><span class="folder-card__title">Клиенты</span><span class="folder-card__meta">Люди и профили</span></button></section>`;
  root.querySelector('[data-open-clients]').addEventListener('click', () => import('./clients/clients.js').then(({ renderClients }) => renderClients(root)));
}
