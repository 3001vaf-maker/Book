import { folderCard, pageHeader } from '../ui/ui.js';
import { canUseBookCapability } from '../core/access.js';
import { getClientCount } from './clients/data.js';

export function renderMain(root) {
  const count = getClientCount();
  const cards = [];
  if (canUseBookCapability('clients.access')) {
    cards.push(folderCard({ title: 'Клиенты', icon: '◫', count, data: 'data-open-clients' }));
  }
  if (canUseBookCapability('finance.access')) {
    cards.push(folderCard({ title: 'Финансы', icon: '◫', data: 'data-open-finance' }));
  }
  root.innerHTML = `${pageHeader('Главная')}${cards.join('')}`;
  root.querySelector('[data-open-clients]')?.addEventListener('click', () => import('./clients/clients.js').then(({ renderClients }) => renderClients(root)));
  root.querySelector('[data-open-finance]')?.addEventListener('click', () => import('./finance/finance.js').then(({ renderFinance }) => renderFinance(root)));
}
