import { getUEI } from '../../core/uei.js';

export function clientDisplay(person = {}) {
  return {
    uei: person.uei || getUEI('person', person.key) || '',
    name: [person?.name, person?.surname].filter(Boolean).join(' ') || 'Без имени',
    phone: person?.phones?.[0] || person?.phone || '',
  };
}
