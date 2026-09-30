import { actionBlock, button, pageHeader } from '../../../../ui/ui.js';

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Подсказки по сообщениям')}
    <div class="action-block"><strong>Структура</strong><div class="muted">Приветствие → причина сообщения → конкретное действие → контакт профиля/бизнеса при необходимости.</div></div>
    <div class="action-block"><strong>Персонализация</strong><div class="muted">Переменные вставляются в произвольное место текста. Финальный конструктор будет переведён на единый селектор «Вставить данные».</div></div>
    `;
  
}
