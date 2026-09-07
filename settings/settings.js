import { folderCard, pageHeader } from '../ui/ui.js';

const folders = [
  ['profile', 'Профиль', '◫', () => import('./profile/profile.js')],
  ['service', 'Сервис', '◫', () => import('./service/service.js')],
  ['warehouse', 'Склад', '◫', () => import('./warehouse/warehouse.js')],
  ['documents', 'Документы', '◫', () => import('./documents/documents.js')],
  ['loyalty', 'Программа лояльности', '◫', () => import('./loyalty/loyalty.js')],
  ['tags', 'Ярлыки', '◫', () => import('./tags/tags.js')],
  ['wallets', 'Кошелёк', '◫', () => import('./wallets/wallets.js')],
];

function renderRows(root) {
  root.innerHTML = `${pageHeader('Настройки')}<div class="ui-folder-grid">${folders.map(([key, label, icon]) => folderCard({ title: label, icon, data: `data-settings-open="${key}"` })).join('')}</div>`;
  root.querySelectorAll('[data-settings-open]').forEach((element) => {
    element.addEventListener('click', async () => {
      const folder = folders.find(([key]) => key === element.dataset.settingsOpen);
      if (!folder) return;
      const module = await folder[3]();
      const render = module.render || module.renderSettings || module.renderService || module.renderTags || module.renderWallets;
      render?.(root, () => renderRows(root));
    });
  });
}

export function renderSettings(root) {
  renderRows(root);
}
