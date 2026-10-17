import { openRecords } from '../../records/records.js';
import { openRecordConfirmationNotice } from '../../ui/record/confirmation-notice.js';
import { calculateSettlement, recordSettlementPricePercent } from '../finance/index.js';
import { procedurePricingForWorkplace } from '../service/procedures/selection.js';

export function openPersonRecordCreation({ person, onCreated = () => {} } = {}) {
  if (!person?.key) return null;

  return openRecords({
    context: 'person',
    person,
    professionalActions: true,
    onCreated: (created, state) => {
      onCreated?.(created);
      const procedures = (state?.procedures || []).map((entry) => {
        const pricing = procedurePricingForWorkplace(entry.raw || {}, state.workplaceId);
        return {
          name: entry.name || '',
          value: entry.cost === '' || entry.cost == null ? pricing.value : entry.cost,
          variable: pricing.variable,
          free: pricing.free,
        };
      });
      const settlement = calculateSettlement((state?.procedures || []).map((entry) => ({
        id: entry.id || '',
        name: entry.name || '',
        cost: entry.cost,
      })), {
        pricePercent: recordSettlementPricePercent(person),
      });
      openRecordConfirmationNotice({
        date: state?.date || '',
        time: state?.from || '',
        procedures,
        total: settlement.planTotal,
        variable: procedures.some((entry) => entry.variable),
      });
    },
  });
}
