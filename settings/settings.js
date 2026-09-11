import { folderList, pageHeader } from '../ui/ui.js';

const folders = [
  ['profile', 'Профиль', '◫', () => import('./profile/profile.js')],
  ['service', 'Сервис', '◫', () => import('./service/service.js')],
  ['online-booking', 'Онлайн-запись', '◫', () => import('./online-booking/online-booking.js')],
  ['documents', 'Документы', '◫', () => import('./documents/documents.js')],
  ['tags', 'Ярлыки', '◫', () => import('./tags/tags.js')],
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
