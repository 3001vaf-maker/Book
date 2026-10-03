import { button, collectCost, costField, durationPicker, field, initCostFields, initDurationPickers, setSharedProfilePrimary, textareaField } from '../../../ui/ui.js';
import { pushProcedureHistory, saveProcedure as saveProcedureData } from './data.js';

export function initialProcedure(existing = null, defaultWorkplace = null) {
  if (existing) return {
    ...existing,
    workplaces: Array.isArray(existing.workplaces) ? existing.workplaces.map((item) => ({ ...item })) : [],
  };
  return {
    id: '',
    photo: '',
    name: '',
    description: '',
    duration: 0,
    breakDuration: 0,
    cost: { mode: 'amount', amount: '', free: false },
    workplaces: defaultWorkplace ? [{ ...defaultWorkplace }] : [],
  };
}

export function procedureEditorForm(existing = null) {
  const procedure = initialProcedure(existing);
  return `<form class="compact-form" data-procedure-editor-form>
    ${field({ label: 'Название', name: 'procedureName', value: procedure.name || '', placeholder: 'Название процедуры', required: true })}
    ${costField({ value: procedure.cost || {}, name: 'procedureCost' })}
    <div class="work-time-row__fields">
      ${durationPicker({ label: 'Длительность', name: 'procedureDuration', value: procedure.duration || 0 })}
      ${durationPicker({ label: 'Перерыв', name: 'procedureBreak', value: procedure.breakDuration || 0 })}
    </div>
    ${textareaField({ label: 'Описание', name: 'procedureDescription', value: procedure.description || '', placeholder: 'Описание процедуры' })}
    <div class="form-error" data-procedure-editor-error></div>
    ${button('Сохранить', {
      className: 'v2-primary-source-only',
      data: 'data-procedure-editor-primary data-v2-primary-action data-v2-primary-label="Сохранить"',
      aria: 'Сохранить процедуру',
    })}
  </form>`;
}

export function bindProcedureEditor(root, {
  existing = null,
  draft = initialProcedure(existing),
  onSaved = () => {},
} = {}) {
  const form = root.querySelector('[data-procedure-editor-form]');
  const primary = root.querySelector('[data-procedure-editor-primary]');
  if (!form || !primary) return { save: async () => null };

  initCostFields(root);
  initDurationPickers(root);

  const save = async () => {
    const data = new FormData(form);
    const name = String(data.get('procedureName') || '').trim();
    const error = root.querySelector('[data-procedure-editor-error]');
    if (!name) {
      if (error) error.textContent = 'Укажите название процедуры.';
      return null;
    }
    setSharedProfilePrimary(primary, { visible: true, label: 'Сохранить', disabled: true });
    const item = {
      ...(existing || {}),
      id: existing?.id || crypto.randomUUID(),
      photo: String(draft.photo || existing?.photo || ''),
      name,
      description: String(data.get('procedureDescription') || '').trim(),
      duration: Number(data.get('procedureDuration') || 0),
      breakDuration: Number(data.get('procedureBreak') || 0),
      cost: collectCost(root, 'procedureCost'),
      workplaces: Array.isArray(draft.workplaces) ? draft.workplaces.map((item) => ({ ...item })) : [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existing) pushProcedureHistory(existing, 'updated');
    saveProcedureData(item);
    if (error) error.textContent = '';
    onSaved(item);
    return item;
  };

  primary.addEventListener('click', save);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save();
  });
  setSharedProfilePrimary(primary, { visible: true, label: 'Сохранить' });
  return { save };
}
