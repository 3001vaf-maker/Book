import { folderCard, pageHeader } from '../ui/ui.js';
import { getClientCount } from './clients/data.js';

export function renderMain(root) {
  const count = getClientCount();
  root.innerHTML = `${pageHeader('Главная')}${folderCard({ title: 'Клиенты', icon: '◫', count, data: 'data-open-clients' })}`;
  root.querySelector('[data-open-clients]').addEventListener('click', () => import('./clients/clients.js').then(({ renderClients }) => renderClients(root)));
}
