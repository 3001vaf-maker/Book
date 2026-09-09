import { button, collectCost, collectWorkplaceSelections, costField, durationPicker, field, initCostFields, initDurationPickers, initPhotoField, initWorkplaceSelectors, mountModal, modal, photoField, textareaField, workplaceSelector } from '../../../ui/ui.js';
import { getWorkplaces } from '../../profile/workplaces/data.js';
import { pushProcedureHistory, saveProcedure as saveProcedureData } from './data.js';

function initialProcedure(existing = null, defaultWorkplaceId = '') {
  if (existing) return existing;
  const workplaces = getWorkplaces();
  const workplace = workplaces.find((item) => String(item?.key || item?.id || '') === String(defaultWorkplaceId || '')) || null;
  return {
    photo: '',
    name: '',
    description: '',
    duration: 0,
    breakDuration: 0,
    cost: { mode: 'amount', amount: '', free: false },
    workplaces: workplace ? [{ workplaceId: workplace.key || workplace.id, name: workplace.name || '' }] : [],
  };
}

export function openProcedureForm({
  root = document.body,
  existing = null,
  defaultWorkplaceId = '',
  variant = '',
  surface = '',
  onSaved = () => {},
} = {}) {
  const procedure = initialProcedure(existing, defaultWorkplaceId);
  const html = `<form class="compact-form" data-procedure-form><div class="modal-title"><h2>${existing ? 'Изменить процедуру' : 'Процедура'}</h2></div>${photoField({ name: 'procedurePhoto', value: procedure.photo || '' })}${field({ label: 'Название', name: 'procedureName', value: procedure.name || '', placeholder: 'Название процедуры', required: true })}${costField({ value: procedure.cost || {}, name: 'procedureCost' })}<div class="work-time-row__fields">${durationPicker({ label: 'Длительность', name: 'procedureDuration', value: procedure.duration || 0 })}${durationPicker({ label: 'Перерыв', name: 'procedureBreak', value: procedure.breakDuration || 0 })}</div>${workplaceSelector({ name: 'procedureWorkplaces', selected: procedure.workplaces || [], allowMultiple: true, workplaces: getWorkplaces() })}${textareaField({ label: 'Описание', name: 'procedureDescription', value: procedure.description || '', placeholder: 'Описание процедуры' })}${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { variant, surface }));
  if (!m) return null;

  initPhotoField(m);
  initCostFields(m);
  initDurationPickers(m);
  initWorkplaceSelectors(m);

  m.querySelector('[data-procedure-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('procedureName') || '').trim();
    if (!name) return;
    const item = {
      id: existing?.id || crypto.randomUUID(),
      photo: String(data.get('procedurePhoto') || ''),
      name,
      description: String(data.get('procedureDescription') || '').trim(),
      duration: Number(data.get('procedureDuration') || 0),
      breakDuration: Number(data.get('procedureBreak') || 0),
      cost: collectCost(m, 'procedureCost'),
      workplaces: collectWorkplaceSelections(m, 'procedureWorkplaces'),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existing) pushProcedureHistory(existing, 'updated');
    saveProcedureData(item);
    m.remove();
    onSaved(item);
  });

  return m;
}
