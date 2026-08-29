/*
 * Settings — владелец первого уровня раздела «Настройки».
 *
 * Здесь пока только структура первого уровня.
 * Внутреннее содержимое папок будет добавляться отдельно.
 */

const SETTINGS_FOLDERS = [
  { id: 'profile', label: 'Профиль пользователя' },
  { id: 'service', label: 'Сервис' },
  { id: 'work-materials', label: 'Рабочие материалы' },
  { id: 'documents', label: 'Документы' },
  { id: 'loyalty', label: 'Лояльность' },
  { id: 'tags', label: 'Ярлыки' },
  { id: 'wallets', label: 'Кошельки' }
];

window.BookSettings = {
  folders: SETTINGS_FOLDERS
};
