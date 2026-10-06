import {
  initViewNavigation,
  openSharedProfileSettingsMenu,
  page,
  viewNavigation,
} from '../../ui/ui.js';
import { serviceHeaderContext, notifyServiceContext } from './context.js';

const views = [
  { id: 'procedures', label: 'Процедуры' },
  { id: 'products', label: 'Товары' },
];

let activeView = 'procedures';
let appearanceModulePromise = null;
let proceduresModulePromise = null;
let productsModulePromise = null;

function loadAppearanceModule() {
  appearanceModulePromise ||= import('./appearance.js');
  return appearanceModulePromise;
}

function loadProceduresModule() {
  proceduresModulePromise ||= import('./procedures/procedures.js');
  return proceduresModulePromise;
}

function loadProductsModule() {
  productsModulePromise ||= import('./products/products.js');
  return productsModulePromise;
}

function openServiceSettings(root, rerender) {
  return openSharedProfileSettingsMenu({
    title: 'Настройки',
    actions: [
      {
        id: 'appearance',
        label: 'Вид',
        onSelect: async () => {
          const { openServiceAppearanceQ } = await loadAppearanceModule();
          if (!root?.isConnected) return;
          openServiceAppearanceQ(root, { onSaved: rerender });
        },
      },
    ],
  });
}

export function renderService(root, navigateBack = () => {}) {
  let disposeCatalog = () => {};
  let renderVersion = 0;

  const renderCurrent = () => {
    const version = ++renderVersion;
    disposeCatalog?.();
    disposeCatalog = () => {};
    const view = views.some((item) => item.id === activeView) ? activeView : 'procedures';
    const title = view === 'products' ? 'Товары' : 'Процедуры';

    root.innerHTML = page([
      serviceHeaderContext({
        title,
        settingsData: 'data-service-settings',
        settingsAria: 'Настройки сервиса',
        c: {
          label: '+',
          data: 'data-service-add',
          aria: view === 'products' ? 'Добавить товар' : 'Добавить процедуру',
        },
      }),
      viewNavigation({ views, activeView: view, ariaLabel: 'Сервис' }),
      '<div data-service-catalog></div>',
    ]);

    root.querySelector('[data-service-settings]')?.addEventListener('click', () => openServiceSettings(root, renderCurrent));

    initViewNavigation(root, {
      views,
      activeView: view,
      onChange: (next) => {
        activeView = next;
        renderCurrent();
      },
    });

    const catalog = root.querySelector('[data-service-catalog]');
    if (catalog) {
      const modulePromise = view === 'products' ? loadProductsModule() : loadProceduresModule();
      void modulePromise.then((module) => {
        if (version !== renderVersion || !catalog.isConnected) return;
        disposeCatalog = view === 'products'
          ? module.renderProductCatalog(catalog, { root, onChanged: renderCurrent })
          : module.renderProcedureCatalog(catalog, { root, onChanged: renderCurrent });
      }).catch((error) => {
        console.error('Service catalog load failed', error);
      });
    }

    root.querySelector('[data-service-add]')?.addEventListener('click', async () => {
      const module = view === 'products' ? await loadProductsModule() : await loadProceduresModule();
      if (!root?.isConnected || version !== renderVersion) return;
      if (view === 'products') module.openProductEditor(root, null, { onChanged: renderCurrent });
      else module.openProcedureEditor(root, null, { onChanged: renderCurrent });
    });

    notifyServiceContext();
  };

  renderCurrent();
  return () => {
    renderVersion += 1;
    disposeCatalog?.();
  };
}

export { renderService as render };
