import { openRecordTransfer } from './record-transfer.js';

export function openRecordEditFlow({
  startAt = 'time',
  date,
  workplaceId,
  from,
  to,
  selectedProcedures = [],
  excludeId = '',
  onApply = () => {},
} = {}) {
  const procedures = (Array.isArray(selectedProcedures) ? selectedProcedures : []).map((item) => ({ ...item }));
  const duration = Math.max(5, procedures.reduce((sum, item) => sum + (Number(item?.duration) || 0), 0));

  return openRecordTransfer({
    startAt,
    date,
    workplaceId,
    from,
    to,
    duration,
    excludeId,
    onApply: (next) => onApply({
      ...next,
      procedures,
    }),
  });
}
