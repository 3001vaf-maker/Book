import { pageHeader, escapeHtml } from '../ui/ui.js';

const folders = [
  ['profile', 'Профиль', () => import('./profile/profile.js')],
  ['service', 'Сервис', () => import('./service/service.js')],
  ['warehouse', 'Склад', () => import('./warehouse/warehouse.js')],
  ['documents', 'Документы', () => import('./documents/documents.js')],
  ['loyalty', 'Программа лояльности', () => import('./loyalty/loyalty.js')],
  ['tags', 'Ярлыки', () => import('./tags/tags.js')],
  ['wallets', 'Кошелёк', () => import('./wallets/wallets.js')],
];

function renderRows(root, navigateBack) {
  root.innerHTML = `${pageHeader('Настройки')}<div class="settings-list">${folders.map(([key, label]) => `<button class="settings-row" type="button" data-settings-open="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><span>›</span></button>`).join('')}</div>`;
  root.querySelectorAll('[data-settings-open]').forEach((element) => {
    element.addEventListener('click', async () => {
      const folder = folders.find(([key]) => key === element.dataset.settingsOpen);
      if (!folder) return;
      const module = await folder[2]();
      const render = module.render || module.renderSettings || module.renderService || module.renderTags || module.renderWallets;
      render?.(root, () => renderRows(root, navigateBack));
    });
  });
}

export function renderSettings(root) {
  renderRows(root, () => renderSettings(root));
}
