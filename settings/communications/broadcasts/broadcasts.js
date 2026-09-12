import { actionBlock, button, folderList, pageHeader } from '../../../ui/ui.js';

function renderBroadcasts(root, navigateBack) {
  root.innerHTML = `${pageHeader('Рассылки')}
    ${folderList([
      { title: 'Новая рассылка', data: 'data-broadcasts-open="compose"' },
      { title: 'Шаблоны сообщений', data: 'data-broadcasts-open="sms-forms"' },
      { title: 'Настройки рассылок', data: 'data-broadcasts-open="settings"' },
      { title: 'Подсказки по сообщениям', data: 'data-broadcasts-open="sms-guide"' },
    ])}
    ${actionBlock(button('Назад', { variant: 'secondary', data: 'data-broadcasts-back' }))}`;

  root.querySelector('[data-broadcasts-open="compose"]')?.addEventListener('click', async () => {
    const { render } = await import('./compose/compose.js'); render(root, () => renderBroadcasts(root, navigateBack));
  });
  root.querySelector('[data-broadcasts-open="settings"]')?.addEventListener('click', async () => {
    const { render } = await import('./settings/settings.js'); render(root, () => renderBroadcasts(root, navigateBack));
  });
  root.querySelector('[data-broadcasts-open="sms-forms"]')?.addEventListener('click', async () => {
    const { render } = await import('./sms-forms/sms-forms.js'); render(root, () => renderBroadcasts(root, navigateBack));
  });
  root.querySelector('[data-broadcasts-open="sms-guide"]')?.addEventListener('click', async () => {
    const { render } = await import('./sms-guide/sms-guide.js'); render(root, () => renderBroadcasts(root, navigateBack));
  });
  root.querySelector('[data-broadcasts-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) { renderBroadcasts(root, navigateBack); }
