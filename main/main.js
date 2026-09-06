import { folderCard, pageHeader } from '../ui/ui.js';
import { getMembers, getUEI } from '../core/uei.js';

const CLIENTS_KEY = 'book.people';

function clientCount() {
  const people = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]').map(({ id, ...person }) => ({
    ...person,
    uei: getUEI('person', person.key) || '',
  }));
  const linked = new Set();

  for (const person of people) {
    if (!person.uei) continue;
    for (const member of getMembers(person.uei).slice(1)) {
      linked.add(member.startsWith('person:') ? member.slice(7) : member);
    }
  }

  return people.filter(person => !linked.has(person.key)).length;
}

export function renderMain(root) {
  const count = clientCount();
  root.innerHTML = `${pageHeader('Главная')}${folderCard({ title: 'Клиенты', icon: '◫', count, data: 'data-open-clients' })}`;
  root.querySelector('[data-open-clients]').addEventListener('click', () => import('./clients/clients.js').then(({ renderClients }) => renderClients(root)));
}
