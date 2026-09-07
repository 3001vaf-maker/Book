import { folderList, pageHeader } from '../ui/ui.js';

const folders = [
  ['profile', 'Профиль', '◫', () => import('./profile/profile.js?v=shared-secondary-button-20260908')],
  ['service', 'Сервис', '◫', () => import('./service/service.js?v=shared-secondary-button-20260908')],
  ['warehouse', 'Склад', '◫', () => import('./warehouse/warehouse.js')],
  ['documents', 'Документы', '◫', () => import('./documents/documents.js')],
  ['loyalty', 'Программа лояльности', '◫', () => import('./loyalty/loyalty.js')],
  ['tags', 'Ярлыки', '◫', () => import('./tags/tags.js?v=shared-render-contract-20260907')],
  ['wallets', 'Кошелёк', '◫', () => import('./wallets/wallets.js?v=custom-wallet-delete-20260908')],
];

function renderRows(root) {
  root.innerHTML = `${pageHeader('Настройки')}${folderList(folders.map(([key, label]) => ({ title: label, data: `data-settings-open="${key}"` })))}`;
  root.querySelectorAll('[data-settings-open]').forEach((element) => {
    element.addEventListener('click', async () => {
      const folder = folders.find(([key]) => key === element.dataset.settingsOpen);
      if (!folder) return;
      const { render } = await folder[3]();
      render(root, () => renderRows(root));
    });
  });
}

export function renderSettings(root) {
  renderRows(root);
}
