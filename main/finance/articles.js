import {
  actionBlock,
  button,
  emptyState,
  escapeHtml,
  field,
  iconButton,
  list,
  mountModal,
  modal,
  pageHeader,
  select,
} from '../../ui/ui.js';
import {
  archiveFinanceArticle,
  createFinanceArticle,
  getFinanceArticles,
  updateFinanceArticle,
} from '../../core/finance/index.js';

const ECONOMIC_OPTIONS = [
  { value: 'OPERATING_REVENUE', label: 'Операционный доход' },
  { value: 'PRODUCT_REVENUE', label: 'Продажа товаров' },
  { value: 'TIPS', label: 'Чаевые' },
  { value: 'LOAN_RECEIVED', label: 'Полученный займ' },
  { value: 'INVESTMENT_RECEIVED', label: 'Полученная инвестиция' },
  { value: 'OPERATING_EXPENSE', label: 'Операционный расход' },
  { value: 'TAX', label: 'Налог' },
  { value: 'REFUND', label: 'Возврат' },
  { value: 'LOAN_REPAYMENT', label: 'Возврат займа' },
  { value: 'INVESTMENT_RETURN', label: 'Возврат инвестиций' },
  { value: 'TRANSFER', label: 'Перевод' },
];

const DIRECTION_OPTIONS = [
  { value: 'IN', label: 'Доход' },
  { value: 'OUT', label: 'Расход' },
  { value: 'TRANSFER', label: 'Перевод' },
];

function treeRows(items = []) {
  const children = new Map();
  items.forEach((item) => {
    const key = String(item.parentArticleId || '');
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(item);
  });
  const result = [];
  const visit = (parentId = '', depth = 0, visited = new Set()) => {
    (children.get(parentId) || []).forEach((item) => {
      if (visited.has(item.articleId)) return;
      const nextVisited = new Set(visited);
      nextVisited.add(item.articleId);
      result.push({ ...item, depth });
      visit(item.articleId, depth + 1, nextVisited);
    });
  };
  visit('');
  items.filter((item) => !result.some((row) => row.articleId === item.articleId))
    .forEach((item) => result.push({ ...item, depth: 0 }));
  return result;
}

function directionLabel(value) {
  return DIRECTION_OPTIONS.find((item) => item.value === value)?.label || value;
}

function economicLabel(value) {
  if (value === 'GROUP') return 'Группа';
  return ECONOMIC_OPTIONS.find((item) => item.value === value)?.label || value;
}

function parentOptions(items, currentId = '') {
  return [
    { value: '', label: 'Корень' },
    ...treeRows(items)
      .filter((item) => item.articleId !== currentId)
      .map((item) => ({
        value: item.articleId,
        label: \`\${'— '.repeat(item.depth)}\${item.name}\`,
      })),
  ];
}

function row(item) {
  return {
    overline: \`\${directionLabel(item.direction)} · \${economicLabel(item.economicType)}\`,
    title: \`\${'— '.repeat(item.depth)}\${item.name}\`,
    secondary: item.systemKey ? 'Системная статья' : '',
    right: '',
    interactive: true,
    data: \`data-finance-article="\${escapeHtml(item.articleId)}"\`,
    aria: \`Открыть статью \${item.name}\`,
  };
}

function renderList(root, navigateBack) {
  const items = getFinanceArticles();
  const rows = treeRows(items);
  root.innerHTML = \`<div class="entity-page-header">\${pageHeader('Статьи')}<div class="page-header-action">\${iconButton('+', { className: 'icon-button--primary', data: 'data-add-finance-article', aria: 'Добавить статью' })}</div></div>\${rows.length ? list({ items: rows.map(row) }) : emptyState('Статей пока нет', 'Добавьте первую статью кнопкой «+».')}\${actionBlock(button('Назад', { variant: 'secondary', data: 'data-finance-articles-back' }))}\`;
  root.querySelector('[data-add-finance-article]')?.addEventListener('click', () => openForm(root, navigateBack));
  root.querySelectorAll('[data-finance-article]').forEach((element) => {
    element.addEventListener('click', () => {
      const item = getFinanceArticles().find((row) => row.articleId === element.dataset.financeArticle);
      if (item) openForm(root, navigateBack, item);
    });
  });
  root.querySelector('[data-finance-articles-back]')?.addEventListener('click', navigateBack);
}

function openForm(root, navigateBack, existing = null) {
  const items = getFinanceArticles();
  const isSystem = Boolean(existing?.systemKey);
  const direction = existing?.direction || 'OUT';
  const economicType = existing?.economicType === 'GROUP' ? 'OPERATING_EXPENSE' : (existing?.economicType || 'OPERATING_EXPENSE');
  const form = \`<form class="compact-form" data-finance-article-form>
    \${field({ label: 'Название', name: 'articleName', value: existing?.name || '', required: true, placeholder: 'Например, Краска' })}
    \${select({ label: 'Родитель', name: 'parentArticleId', value: existing?.parentArticleId || '', options: parentOptions(items, existing?.articleId || '') })}
    \${select({ label: 'Тип', name: 'direction', value: direction, options: DIRECTION_OPTIONS })}
    \${select({ label: 'Экономический характер', name: 'economicType', value: economicType, options: ECONOMIC_OPTIONS })}
    \${button('Сохранить', { type: 'submit' })}
    \${existing && !isSystem ? button('Удалить', { type: 'button', variant: 'danger', data: 'data-delete-finance-article' }) : ''}
  </form>\`;
  const m = mountModal(root, modal(form, { title: existing ? 'Изменить статью' : 'Новая статья' }));
  if (!m) return;
  m.querySelector('[data-finance-article-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      name: String(data.get('articleName') || '').trim(),
      parentArticleId: String(data.get('parentArticleId') || ''),
      direction: String(data.get('direction') || ''),
      economicType: String(data.get('economicType') || ''),
    };
    if (!payload.name) return;
    if (existing) await updateFinanceArticle(existing.articleId, payload);
    else await createFinanceArticle(payload);
    m.remove();
    renderList(root, navigateBack);
  });
  m.querySelector('[data-delete-finance-article]')?.addEventListener('click', async () => {
    await archiveFinanceArticle(existing.articleId);
    m.remove();
    renderList(root, navigateBack);
  });
}

export function renderFinanceArticles(root, navigateBack = () => {}) {
  renderList(root, navigateBack);
}
