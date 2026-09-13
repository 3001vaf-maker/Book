import { actionBlock, button, pageHeader } from '../../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Настройки рассылок')}
    <div class="action-block"><strong>Безопасная отправка</strong><div class="muted">Аудитория проверяется сервером по согласию и наличию выбранного канала. Пустой выбор не означает «всем».</div></div>
    <div class="action-block"><strong>Лимит</strong><div class="muted">Массовая отправка ограничивается серверным лимитом сообщений в минуту.</div></div>
    ${actionBlock(button('Назад', { variant: 'secondary', data: 'data-broadcast-settings-back' }))}`;
  root.querySelector('[data-broadcast-settings-back]')?.addEventListener('click', navigateBack);
}
