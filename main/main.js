import { folderCard, pageHeader } from '../ui/ui.js';

export function renderMain(root) {
  const count = JSON.parse(localStorage.getItem('book.people') || '[]').length;
  root.innerHTML = `${pageHeader('Главная')}${folderCard({ title: 'Клиенты', icon: '◫', count, data: 'data-open-clients' })}`;
  root.querySelector('[data-open-clients]').addEventListener('click', () => import('./clients/clients.js').then(({ renderClients }) => renderClients(root)));
}
