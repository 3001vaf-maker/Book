import {
  actionBlock,
  button,
  emptyState,
  field,
  list,
  openNotice,
  pageHeader,
} from '../../ui/ui.js';
import { getZReport } from '../../core/finance/index.js';

function localDateValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

function money(value = 0, signed = false) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount).toLocaleString('ru-RU').replaceAll('\u00a0', ' ');
  if (!signed || Math.abs(amount) < 0.009) return `${absolute} ₽`;
  return `${amount < 0 ? '−' : '+'}${absolute} ₽`;
}

function rangeToIso(from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return null;
  return { from: start.toISOString(), to: end.toISOString() };
}

function summaryList(report) {
  return list({
    items: [
      { title: 'Приход', right: money(report.totals.incoming), interactive: false },
      { title: 'Расход', right: money(report.totals.outgoing), interactive: false },
      { title: 'Чистое движение', right: money(report.totals.netCash, true), interactive: false },
      { title: 'Выручка услуг', right: money(report.totals.serviceRevenue), interactive: false },
      { title: 'Операционные доходы', right: money(report.totals.operatingRevenue), interactive: false },
      { title: 'Продажа товаров', right: money(report.totals.productRevenue), interactive: false },
      { title: 'Операционные расходы', right: money(report.totals.operatingExpense), interactive: false },
      { title: 'Налоги', right: money(report.totals.tax), interactive: false },
      { title: 'Чаевые', right: money(report.totals.tips), interactive: false },
      { title: 'Возвраты', right: money(report.totals.refunds), interactive: false },
      { title: 'Получено займов', right: money(report.totals.loanReceived), interactive: false },
      { title: 'Возвращено займов', right: money(report.totals.loanRepaid), interactive: false },
      { title: 'Получено инвестиций', right: money(report.totals.investmentReceived), interactive: false },
      { title: 'Возвращено инвестиций', right: money(report.totals.investmentReturned), interactive: false },
    ],
  });
}

function breakdown(title, rows = []) {
  if (!rows.length) return '';
  return `<section><h3>${title}</h3>${list({
    items: rows.map((row) => ({
      title: row.label,
      secondary: `Приход ${money(row.incoming)} · Расход ${money(row.outgoing)}`,
      right: money(row.net, true),
      interactive: false,
    })),
  })}</section>`;
}

function renderReport(root, navigateBack, from, to) {
  const range = rangeToIso(from, to);
  if (!range) {
    openNotice({ message: 'Проверьте период отчёта.' });
    return renderZReport(root, navigateBack);
  }
  const report = getZReport(range);
  const content = report.entries.length
    ? `${summaryList(report)}${breakdown('По кошелькам', report.byWallet)}${breakdown('По статьям', report.byArticle)}${breakdown('По экономическому смыслу', report.byEconomicType)}`
    : emptyState('Нет движений', 'За выбранный период в ДДС нет операций.');

  root.innerHTML = `${pageHeader('Z-отчёт', `${from} — ${to}`)}
    <form class="compact-form" data-z-report-form>
      ${field({ label: 'С', name: 'from', type: 'date', value: from, required: true })}
      ${field({ label: 'По', name: 'to', type: 'date', value: to, required: true })}
      ${button('Показать', { type: 'submit' })}
    </form>
    ${content}
    ${actionBlock(button('Назад', { variant: 'secondary', data: 'data-z-report-back' }))}`;

  root.querySelector('[data-z-report-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    renderReport(root, navigateBack, String(data.get('from') || ''), String(data.get('to') || ''));
  });
  root.querySelector('[data-z-report-back]')?.addEventListener('click', navigateBack);
}

export function renderZReport(root, navigateBack = () => {}) {
  const today = localDateValue();
  renderReport(root, navigateBack, today, today);
}
