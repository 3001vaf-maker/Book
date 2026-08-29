/* Настройки — владелец первого уровня раздела «Настройки». */

const SETTINGS_FOLDERS = Object.freeze([
  { id: 'profile', label: 'Профиль пользователя' },
  { id: 'service', label: 'Сервис' },
  { id: 'work-materials', label: 'Рабочие материалы' },
  { id: 'documents', label: 'Документы' },
  { id: 'loyalty', label: 'Лояльность' },
  { id: 'tags', label: 'Ярлыки' },
  { id: 'wallets', label: 'Кошельки' }
]);

window.BookSettings = Object.freeze({
  folders: SETTINGS_FOLDERS
});
