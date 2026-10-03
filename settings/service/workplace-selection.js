import { checkList, initCheckList, modal, mountModal } from '../../ui/ui.js';
import { getWorkplaces } from '../profile/workplaces/data.js';

function workplaceId(value = {}) {
  return String(value.workplaceId || value.id || value.key || '');
}

export function normalizeServiceWorkplaces(selected = []) {
  const selectedIds = new Set((Array.isArray(selected) ? selected : []).map(workplaceId).filter(Boolean));
  return getWorkplaces()
    .filter((workplace) => selectedIds.has(String(workplace.key || workplace.id || '')))
    .map((workplace) => ({
      workplaceId: String(workplace.key || workplace.id || ''),
      name: String(workplace.name || ''),
    }));
}

export function openServiceWorkplaceSelection({
  selected = [],
  title = 'Рабочие пространства',
  onChange = () => {},
} = {}) {
  const selectedIds = new Set((Array.isArray(selected) ? selected : []).map(workplaceId).filter(Boolean));
  const workplaces = getWorkplaces();
  const body = checkList(workplaces.map((workplace) => ({
    value: String(workplace.key || workplace.id || ''),
    label: String(workplace.name || 'Рабочее пространство'),
    checked: selectedIds.has(String(workplace.key || workplace.id || '')),
  })));
  const layer = mountModal(document.body, modal(body, {
    variant: 'bottom',
    title,
    className: 'modal--service-workplaces',
  }));
  if (!layer) return null;
  initCheckList(layer);
  layer.querySelectorAll('.ui-check-list input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', () => {
      const ids = new Set([...layer.querySelectorAll('.ui-check-list input[type="checkbox"]')]
        .filter((item) => item.checked)
        .map((item) => String(item.value || ''))
        .filter(Boolean));
      const next = workplaces
        .filter((workplace) => ids.has(String(workplace.key || workplace.id || '')))
        .map((workplace) => ({
          workplaceId: String(workplace.key || workplace.id || ''),
          name: String(workplace.name || ''),
        }));
      onChange(next);
    });
  });
  return layer;
}
