import { folderCard, pageHeader } from '../ui/ui.js';
import { canUseBookCapability } from '../core/access.js';
import { getPeopleCount } from './people/data.js';

export function renderMain(root) {
  const count = getPeopleCount();
  const cards = [];
  if (canUseBookCapability('people.access')) {
    cards.push(folderCard({ title: 'Клиенты', icon: '◫', count, data: 'data-open-people' }));
  }
  if (canUseBookCapability('finance.access')) {
    cards.push(folderCard({ title: 'Финансы', icon: '◫', data: 'data-open-finance' }));
  }
  root.innerHTML = `${pageHeader('Главная')}${cards.join('')}`;
  root.querySelector('[data-open-people]')?.addEventListener('click', () => import('./people/people.js').then(({ renderPeople }) => renderPeople(root)));
  root.querySelector('[data-open-finance]')?.addEventListener('click', () => import('./finance/finance.js').then(({ renderFinance }) => renderFinance(root)));
}
