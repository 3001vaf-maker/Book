import {
  button,
  initViewNavigation,
  openSharedPhotoAction,
  openSharedProfileSettingsMenu,
  page,
  viewNavigation,
} from '../../ui/ui.js';
import { getProfile, saveProfile as saveProfileData } from '../profile/data.js';
import { openProfileAppearanceQ } from '../profile/profile.js';
import { serviceHeaderContext, notifyServiceContext } from './context.js';
import { openProcedureEditor, renderProcedureCatalog } from './procedures/procedures.js';
import { openProductEditor, renderProductCatalog } from './products/products.js';

const views = [
  { id: 'procedures', label: 'Процедуры' },
  { id: 'products', label: 'Товары' },
];

let activeView = 'procedures';

function openServiceSettings(root, rerender) {
  const profile = getProfile();
  return openSharedProfileSettingsMenu({
    title: 'Настройки',
    actions: [
      {
        id: 'photo',
        label: 'Фото',
        onSelect: () => openSharedPhotoAction({
          photo: profile.photo || '',
          onReplace: async (photo) => {
            await saveProfileData({ ...getProfile(), photo });
            rerender();
          },
          onDelete: async () => {
            await saveProfileData({ ...getProfile(), photo: '' });
            rerender();
          },
        }),
      },
      {
        id: 'appearance',
        label: 'Вид',
        onSelect: () => openProfileAppearanceQ(root, {
          onSaved: rerender,
        }),
      },
    ],
  });
}

function renderServiceSurface(root, navigateBack = () => {}) {
  const view = views.some((item) => item.id === activeView) ? activeView : 'procedures';
  const title = view === 'products' ? 'Товары' : 'Процедуры';
  let disposeCatalog = () => {};

  const rerender = () => {
    disposeCatalog?.();
    renderServiceSurface(root, navigateBack);
  };

  root.innerHTML = page([
    serviceHeaderContext({
      title,
      settingsData: 'data-service-settings',
      settingsAria: 'Настройки сервиса',
    }),
    viewNavigation({ views, activeView: view, ariaLabel: 'Сервис' }),
    '<div data-service-catalog></div>',
    button('+', {
      className: 'v2-primary-source-only',
      data: 'data-service-add data-v2-primary-action data-v2-primary-label="+"',
      aria: view === 'products' ? 'Добавить товар' : 'Добавить процедуру',
    }),
  ]);

  root.querySelector('[data-service-settings]')?.addEventListener('click', () => openServiceSettings(root, rerender));
  initViewNavigation(root, {
    views,
    activeView: view,
    onChange: (next) => {
      activeView = next;
      rerender();
    },
  });

  const catalog = root.querySelector('[data-service-catalog]');
  if (catalog) {
    disposeCatalog = view === 'products'
      ? renderProductCatalog(catalog, { root, onChanged: rerender })
      : renderProcedureCatalog(catalog, { root, onChanged: rerender });
  }

  root.querySelector('[data-service-add]')?.addEventListener('click', () => {
    if (view === 'products') openProductEditor(root, null, { onChanged: rerender });
    else openProcedureEditor(root, null, { onChanged: rerender });
  });

  notifyServiceContext();
  return () => disposeCatalog?.();
}

export function renderService(root, navigateBack = () => {}) {
  return renderServiceSurface(root, navigateBack);
}

export { renderService as render };
