import { modal, mountModal, v2ListEntries, v2ListEntry } from '../../ui/ui.js';
import {
  clearProgramAssignment,
  getLoyaltyPrograms,
  isProgramAssignedToPerson,
  setProgramAssignment,
} from './data.js';

function programRows(personKey) {
  const rows = [];
  for (const kind of ['referral', 'bonus']) {
    for (const program of getLoyaltyPrograms(kind).filter((item) => item.status === 'active')) {
      const checked = isProgramAssignedToPerson(kind, program.id, personKey);
      rows.push(v2ListEntry({
        overline: kind === 'referral' ? 'Реферальная программа' : 'Бонусная программа',
        title: program.name,
        subtitle: program.audienceMode === 'all' ? 'Всем контактам' : 'Выбранным контактам',
        interactive: false,
        toggleData: `data-contact-loyalty-kind="${kind}" data-contact-loyalty-program="${program.id}"`,
        toggleAria: `${checked ? 'Отключить' : 'Назначить'} ${program.name}`,
        toggleChecked: checked,
      }));
    }
  }
  return rows;
}

export function openContactLoyalty(root, person) {
  const personKey = String(person?.key || '');
  if (!personKey) return null;
  const rows = programRows(personKey);
  const body = rows.length
    ? v2ListEntries(rows)
    : '<p>Активных Реферальных и Бонусных программ пока нет.</p>';
  const layer = mountModal(root, modal(body, {
    title: 'Лояльность',
    variant: 'x',
    surface: 'app',
  }));
  layer?.querySelectorAll('[data-contact-loyalty-program]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const kind = String(toggle.dataset.contactLoyaltyKind || '');
      const programId = String(toggle.dataset.contactLoyaltyProgram || '');
      const program = getLoyaltyPrograms(kind).find((item) => item.id === programId);
      if (!program) return;
      const currentlyAssigned = isProgramAssignedToPerson(kind, programId, personKey);
      if (currentlyAssigned) {
        if (program.audienceMode === 'all') setProgramAssignment(kind, programId, personKey, 'excluded');
        else clearProgramAssignment(kind, programId, personKey);
      } else if (program.audienceMode === 'all') {
        clearProgramAssignment(kind, programId, personKey);
      } else {
        setProgramAssignment(kind, programId, personKey, 'assigned');
      }
      layer.v2Close?.();
      openContactLoyalty(root, person);
    });
  });
  return layer;
}
