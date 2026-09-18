import { folderCard, pageHeader } from '../ui/ui.js';
import { canUseBookCapability } from '../core/access.js';
import { getClientCount } from './clients/data.js';

async function openFeature(root, button, options, domains, loader, renderName) {
  button.disabled = true;
  try {
    await options.ensureDomains?.(domains);
    const module = await loader();
    module[renderName](root);
  } catch (error) {
    button.disabled = false;
    options.onDomainError?.(error);
  }
}

export function renderMain(root, options = {}) {
  const businessReady = options.domainReady?.('business') === true;
  const count = businessReady ? getClientCount() : null;
  const cards = [];
  if (canUseBookCapability('clients.access')) {
    cards.push(folderCard({
      title: 'Клиенты',
      icon: '◫',
      ...(businessReady ? { count } : {}),
      data: 'data-open-clients',
    }));
  }
  if (canUseBookCapability('finance.access')) {
    cards.push(folderCard({ title: 'Финансы', icon: '◫', data: 'data-open-finance' }));
  }
  root.innerHTML = `${pageHeader('Главная')}${cards.join('')}`;

  const clientsButton = root.querySelector('[data-open-clients]');
  clientsButton?.addEventListener('click', () => {
    void openFeature(
      root,
      clientsButton,
      options,
      ['business', 'documents'],
      () => import('./clients/clients.js'),
      'renderClients',
    );
  });

  const financeButton = root.querySelector('[data-open-finance]');
  financeButton?.addEventListener('click', () => {
    void openFeature(
      root,
      financeButton,
      options,
      ['auxiliary'],
      () => import('./finance/finance.js'),
      'renderFinance',
    );
  });
}
