import {
  initViewNavigation,
  openSharedProfileSettingsMenu,
  page,
  viewNavigation,
} from '../../ui/ui.js';
import { serviceHeaderContext, notifyServiceContext } from './context.js';
import { openServiceAppearanceQ } from './appearance.js';
import { openProcedureEditor, renderProcedureCatalog } from './procedures/procedures.js';
import { openProductEditor, renderProductCatalog } from './products/products.js';

const views = [
  { id: 'procedures', label: 'Процедуры' },
  { id: 'products', label: 'Товары' },
];

let activeView = 'procedures';

function openServiceSettings(root, rerender) {
  return openSharedProfileSettingsMenu({
    title: 'Настройки',
    actions: [
      {
        id: 'appearance',
        label: 'Вид',
        onSelect: () => openServiceAppearanceQ(root, { onSaved: rerender }),
      },
    ],
  });
}

export function renderService(root, navigateBack = () => {}) {
  let disposeCatalog = () => {};

  const renderCurrent = () => {
    disposeCatalog?.();
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
      disposeCatalog = view === 'products'
        ? renderProductCatalog(catalog, { root, onChanged: renderCurrent })
        : renderProcedureCatalog(catalog, { root, onChanged: renderCurrent });
    }

    root.querySelector('[data-service-add]')?.addEventListener('click', () => {
      if (view === 'products') openProductEditor(root, null, { onChanged: renderCurrent });
      else openProcedureEditor(root, null, { onChanged: renderCurrent });
    });

    notifyServiceContext();
  };

  renderCurrent();
  return () => disposeCatalog?.();
}

export { renderService as render };
