import { button, escapeHtml, pageHeader } from '../../ui/ui.js';

const children = [
  ['deposit', 'Депозит'],
  ['personal-account', 'Личный счёт'],
  ['referral-program', 'Реферальная программа'],
  ['bonus-program', 'Бонусная программа'],
  ['certificates', 'Сертификаты'],
  ['subscriptions', 'Абонементы'],
];

function renderLoyaltyFolders(root, navigateBack) {
  root.innerHTML = `${pageHeader('Программа лояльности')}<div class="settings-list">${children.map(([key, label]) => `<button class="settings-row" type="button" data-loyalty-open="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><span>›</span></button>`).join('')}</div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-loyalty-back' })}</div>`;
  root.querySelectorAll('[data-loyalty-open]').forEach((element) => element.addEventListener('click', () => {
    const label = children.find(([key]) => key === element.dataset.loyaltyOpen)?.[1];
    if (!label) return;
    root.innerHTML = `${pageHeader(label)}<div class="empty-state"><strong>Раздел подготовлен</strong><span>Содержимое добавляется отдельным ТЗ.</span></div><div class="profile-actions">${button('Назад', { className: 'ui-button--secondary', data: 'data-loyalty-child-back' })}</div>`;
    root.querySelector('[data-loyalty-child-back]')?.addEventListener('click', () => renderLoyaltyFolders(root, navigateBack));
  }));
  root.querySelector('[data-loyalty-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  renderLoyaltyFolders(root, navigateBack);
}
