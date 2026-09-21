import { bottomNavigation, folderCard, folderList, modal, mountModal, pageHeader, viewNavigation } from '../ui/ui.js';

const app = document.querySelector('#preview-app');

function settingsScreen() {
  return `${pageHeader('Настройки')}${folderList([
    { title: 'Профиль' },
    { title: 'Сервис' },
    { title: 'Онлайн-запись' },
    { title: 'Уведомления' },
    { title: 'Интеграции' },
    { title: 'Документы' },
    { title: 'Ярлыки' },
  ])}`;
}

function background(step) {
  const key = String(step?.key || '');
  if (key === 'profile') {
    return `${pageHeader('Профиль')}${folderList([{ title: 'Личные данные' }, { title: 'Контактные данные' }, { title: 'Профессиональные данные' }, { title: 'Рабочее пространство' }])}`;
  }
  if (key === 'procedures' || key === 'products') {
    return `${pageHeader('Сервис')}${folderList([{ title: 'Услуги' }, { title: 'Товары' }])}`;
  }
  if (['online-booking','notifications','integrations','tags','documents'].includes(key)) return settingsScreen();
  if (key === 'people') return `${pageHeader('Люди','',1)}${folderList([{ title: 'Учебный человек' }])}`;
  if (key === 'timetable') return `${pageHeader('График')}<div class="preview-note">Календарь рабочего времени</div>`;
  if (key.startsWith('journal') || key === 'payment') {
    return `${pageHeader('Журнал')}${viewNavigation({ views:[{id:'day',label:'День'},{id:'month',label:'Месяц'},{id:'list',label:'Список'}],activeView:key==='journal-month'?'month':key==='journal-list'?'list':'day' })}<div class="preview-note">Рабочая область журнала</div>`;
  }
  if (key === 'chat') return `${pageHeader('Чат')}<div class="preview-note">Диалоги и сообщения</div>`;
  if (key.startsWith('finance')) {
    return `${pageHeader('Финансы')}<div class="ui-folder-grid">
      ${folderCard({title:'Касса',icon:'₽',variant:'compact'})}
      ${folderCard({title:'ДДС',icon:'▤',variant:'compact'})}
      ${folderCard({title:'Доход / Расход',icon:'±',variant:'compact'})}
      ${folderCard({title:'Статьи',icon:'≡',variant:'compact'})}
    </div>`;
  }
  return `${pageHeader('Главная')}<div class="preview-note">Рабочая область</div>`;
}

function render(step) {
  document.querySelectorAll('[data-modal]').forEach((node) => node.remove());
  app.innerHTML = `<main class="app-content">${background(step)}</main>${bottomNavigation(
    step?.key === 'timetable' ? 'timetable' : step?.key?.startsWith('journal') || step?.key === 'payment' ? 'journal' : step?.key === 'chat' ? 'chat' : 'main',
    ['main','timetable','journal','chat','settings'],
  )}`;

  const content = `<div class="modal-title"><h2></h2><p></p></div><div class="modal-actions"><button type="button" class="ui-button"></button></div>`;
  const layer = mountModal(document.body, modal(content, {
    title: String(step?.modalTitle || step?.title || 'Предпросмотр'),
    variant: 'medium',
    surface: 'app',
  }));
  if (!layer) return;
  layer.querySelector('.modal-title h2').textContent = String(step?.modalTitle || step?.title || '');
  layer.querySelector('.modal-title p').textContent = String(step?.modalBody || '');
  layer.querySelector('.ui-button').textContent = String(step?.primaryLabel || 'Далее');
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  if (event.data?.type !== 'first-run-preview') return;
  render(event.data.step || {});
});
