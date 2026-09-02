import { pageHeader, escapeHtml } from '../ui/ui.js';
import { render as renderProfile } from './profile/profile.js';
import { renderService } from './service/service.js';
import { render as renderWarehouse } from './warehouse/warehouse.js';
import { render as renderDocuments } from './documents/documents.js';
import { render as renderLoyalty } from './loyalty/loyalty.js';
import { renderTags } from './tags/tags.js';
import { renderWallets } from './wallets/wallets.js';

const folders = [
  ['profile', 'Профиль', renderProfile],
  ['service', 'Сервис', renderService],
  ['warehouse', 'Склад', renderWarehouse],
  ['documents', 'Документы', renderDocuments],
  ['loyalty', 'Программа лояльности', renderLoyalty],
  ['tags', 'Ярлыки', renderTags],
  ['wallets', 'Кошелёк', renderWallets],
];

function renderRows(root, navigateBack) {
  root.innerHTML = `${pageHeader('Настройки')}<div class="settings-list">${folders.map(([key, label]) => `<button class="settings-row" type="button" data-settings-open="${escapeHtml(key)}"><span>${escapeHtml(label)}</span><span>›</span></button>`).join('')}</div>`;
  root.querySelectorAll('[data-settings-open]').forEach((element) => {
    element.addEventListener('click', () => {
      const folder = folders.find(([key]) => key === element.dataset.settingsOpen);
      folder?.[2]?.(root, () => renderRows(root, navigateBack));
    });
  });
}

export function renderSettings(root) {
  renderRows(root, () => renderSettings(root));
}
