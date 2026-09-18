import { canUseBookCapability } from '../core/access.js';
import { folderList, pageHeader } from '../ui/ui.js';

const folders = [
  ['profile', 'Профиль', '◫', () => import('./profile/profile.js'), 'profile.access'],
  ['service', 'Сервис', '◫', () => import('./service/service.js'), 'services.access'],
  ['online-booking', 'Онлайн-запись', '◫', () => import('./online-booking/online-booking.js'), 'online_booking.access'],
  ['communications', 'Уведомления', '◫', () => import('./communications/communications.js'), 'notifications.access'],
  ['integrations', 'Интеграции', '◫', () => import('./integrations/integrations.js'), 'integrations.access'],
  ['documents', 'Документы', '◫', () => import('./documents/documents.js'), 'documents.access'],
  ['tags', 'Ярлыки', '◫', () => import('./tags/tags.js'), 'tags.access'],
];

function availableFolders() {
  return folders.filter((folder) => canUseBookCapability(folder[4]));
}

async function openFolder(root, key) {
  const visible = availableFolders();
  const folder = visible.find(([folderKey]) => folderKey === key);
  if (!folder) return false;
  const { render } = await folder[3]();
  render(root, () => renderRows(root));
  return true;
}

function renderRows(root) {
  const visible = availableFolders();
  root.innerHTML = `${pageHeader('Настройки')}${folderList(visible.map(([key, label]) => ({ title: label, data: `data-settings-open="${key}"` })))}`;
  root.querySelectorAll('[data-settings-open]').forEach((element) => {
    element.addEventListener('click', () => void openFolder(root, element.dataset.settingsOpen));
  });
}

export function renderSettings(root, options = {}) {
  renderRows(root);
  const requested = String(options?.openFolder || '').trim();
  if (requested) queueMicrotask(() => void openFolder(root, requested));
}
