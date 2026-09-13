import { actionBlock, button, pageHeader } from '../../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Подсказки по сообщениям')}
    <div class="action-block"><strong>Структура</strong><div class="muted">Приветствие → причина сообщения → конкретное действие → контакт мастера/бизнеса при необходимости.</div></div>
    <div class="action-block"><strong>Персонализация</strong><div class="muted">Переменные вставляются в произвольное место текста. Финальный конструктор будет переведён на единый селектор «Вставить данные».</div></div>
    ${actionBlock(button('Назад', { variant: 'secondary', data: 'data-broadcast-guide-back' }))}`;
  root.querySelector('[data-broadcast-guide-back]')?.addEventListener('click', navigateBack);
}
