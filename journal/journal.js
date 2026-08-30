import { pageHeader, emptyState } from '../ui/ui.js';
export function renderJournal(root) { root.innerHTML = `${pageHeader('Журнал')}<div class="segment-control"><button class="is-active">День</button><button>Месяц</button><button>Список</button></div>${emptyState('Журнал пока пуст','Записи появятся после добавления соответствующего ТЗ.')}`; }
