import { folderCard, pageHeader } from '../ui/ui.js';
import { getClientCount } from './clients/data.js';

export function renderMain(root) {
  const count = getClientCount();
  root.innerHTML = `${pageHeader('Главная')}${folderCard({ title: 'Клиенты', icon: '◫', count, data: 'data-open-clients' })}${folderCard({ title: 'Финансы', icon: '◫', data: 'data-open-finance' })}`;
  root.querySelector('[data-open-clients]').addEventListener('click', () => import('./clients/clients.js').then(({ renderClients }) => renderClients(root)));
  root.querySelector('[data-open-finance]').addEventListener('click', () => import('./finance/finance.js').then(({ renderFinance }) => renderFinance(root)));
}
