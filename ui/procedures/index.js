import { escapeHtml } from '../utils/escape-html.js';

const fmtMoney = (value) => value === '' || value == null ? '' : `${Number(value).toLocaleString('ru-RU')} ₽`;
const costText = (cost) => {
  if (!cost || cost.free) return '';
  if (cost.mode === 'from-to') return `от ${fmtMoney(cost.from)}<br>до ${fmtMoney(cost.to)}`;
  if (cost.mode === 'from') return `от ${fmtMoney(cost.from ?? cost.amount)}`;
  return fmtMoney(cost.amount ?? cost.from);
};
const durationText = (minutes) => {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return hours ? `${hours} ч${rest ? ` ${rest} мин` : ''}` : `${rest} мин`;
};

export function procedureItem({ procedure = {}, cost = procedure.cost, interactive = true, data = '', selected = false, action = '', className = '' } = {}) {
  const tag = interactive ? 'button' : 'div';
  const attrs = interactive ? `type="button" ${data} aria-pressed="${selected}"` : data;
  const contextualAction = action || (String(data).includes('data-procedure=') ? `<span class="entity-list-row__delete" data-delete-procedure="${escapeHtml(procedure.id || '')}">×</span>` : '');
  return `<${tag} class="entity-list-row ${selected ? 'is-selected' : ''} ${className}" ${attrs}><span class="entity-list-row__main"><strong>${escapeHtml(procedure.name || '')}</strong><small>${durationText(procedure.duration)}</small></span><span class="entity-list-row__price">${costText(cost)}</span>${contextualAction}</${tag}>`;
}

export { costText as procedureCostText, durationText as procedureDurationText };
