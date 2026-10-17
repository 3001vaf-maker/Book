import {
  durationText,
  mountRecordZ,
  recordZHost,
  recordConfirmationMiniCard,
} from '../ui/ui.js';
import { getWorkplaces } from '../core/workplace-time.js';
import { personDisplay } from '../core/people/presentation.js';
import { getRecordPaymentState, recordAmountDue } from '../core/finance/index.js';

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(-2)}` : String(value || '');
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) || 0)} ₽`;
}

function workplaceName(id) {
  const workplace = getWorkplaces().find((item) => String(item?.key ?? item?.id ?? '') === String(id || ''));
  return workplace?.name || workplace?.title || 'Рабочее пространство';
}

export function openJournalView(record, { onClose = () => {} } = {}) {
  if (!record?.id) return null;

  const person = personDisplay(record.person || {});
  const procedures = Array.isArray(record.procedures) ? record.procedures : [];
  const totalDuration = procedures.reduce((sum, item) => sum + (Number(item?.duration) || 0), 0);
  const payment = getRecordPaymentState(record);
  const discountPercent = Number(record?.finance?.discountPercent || 0);

  const layer = mountRecordZ({
    settings: false,
    title: person.name || 'Запись',
    className: 'journal-view-z',
    onClose,
  });
  if (!layer) return null;

  const root = recordZHost(layer);
  root.innerHTML = `<div class="record-screen record-screen--state-view">${recordConfirmationMiniCard({
    workplace: workplaceName(record.workplaceId),
    date: formatDate(record.date),
    period: `${record.from || ''} - ${record.to || ''}`,
    uei: person.uei || '',
    name: person.name || 'Запись',
    phone: person.phone || '',
    groupText: record.group ? `Участники: ${Array.isArray(record.group?.participants) ? record.group.participants.length : 0} / ${Math.max(2, Math.floor(Number(record.group?.capacity) || 2))}` : '',
    duration: durationText(totalDuration || 30),
    discount: discountPercent > 0 ? `${discountPercent}%` : '0%',
    total: formatMoney(recordAmountDue(record)),
    procedures: procedures.map((item) => ({
      name: item?.name || '',
      durationText: durationText(Number(item?.duration) || 0),
      right: item?.cost === '' || item?.cost == null ? '' : formatMoney(item.cost),
    })),
  })}</div>`;

  layer.dataset.journalViewPaymentState = payment.fullyPaid ? 'paid' : payment.partiallyPaid ? 'partial' : 'unpaid';
  return layer;
}
