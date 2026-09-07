import { actionBlock, button, folderCard, pageHeader } from '../../ui/ui.js';

const children = [
  ['deposit', 'Депозит', '◫'],
  ['personal-account', 'Личный счёт', '◫'],
  ['referral-program', 'Реферальная программа', '◫'],
  ['bonus-program', 'Бонусная программа', '◫'],
  ['certificates', 'Сертификаты', '◫'],
  ['subscriptions', 'Абонементы', '◫'],
];

const loaders = {
  deposit: () => import('./deposit/deposit.js'),
  'personal-account': () => import('./personal-account/personal-account.js'),
  'referral-program': () => import('./referral-program/referral-program.js'),
  'bonus-program': () => import('./bonus-program/bonus-program.js'),
  certificates: () => import('./certificates/certificates.js'),
  subscriptions: () => import('./subscriptions/subscriptions.js'),
};

function renderLoyaltyFolders(root, navigateBack) {
  root.innerHTML = `${pageHeader('Программа лояльности')}<div class="ui-folder-grid">${children.map(([key, label, icon]) => folderCard({ title: label, icon, data: `data-loyalty-open="${key}"` })).join('')}</div>${actionBlock(button('Назад', { className: 'ui-button--secondary', data: 'data-loyalty-back' }))}`;
  root.querySelectorAll('[data-loyalty-open]').forEach((element) => element.addEventListener('click', async () => {
    const loader = loaders[element.dataset.loyaltyOpen];
    if (!loader) return;
    const { render } = await loader();
    render(root, () => renderLoyaltyFolders(root, navigateBack));
  }));
  root.querySelector('[data-loyalty-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  renderLoyaltyFolders(root, navigateBack);
}
