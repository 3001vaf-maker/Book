import { button, field, mountModal, modal, phoneField } from '../../ui/ui.js';
import { createPerson, getAllPeople, savePeople } from './data.js';

export function openPersonCreate({
  root = document.body,
  preset = {},
  variant = 'medium',
  surface = '',
  onCreated = () => {},
} = {}) {
  const html = `<form data-person-create-form><div class="modal-title"><h2>Создать</h2></div>${field({ label: 'Имя', name: 'name', value: preset.name || '', required: true })}${field({ label: 'Фамилия', name: 'surname', value: preset.surname || '' })}${phoneField({ label: 'Телефон', name: 'phone', value: preset.phone || '' })}<div class="form-error" data-error></div>${button('Сохранить', { type: 'submit' })}</form>`;
  const m = mountModal(root, modal(html, { variant, surface }));
  if (!m) return null;

  m.querySelector('[data-person-create-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const all = getAllPeople();
    try {
      const person = createPerson(
        String(form.get('name') || '').trim(),
        String(form.get('surname') || '').trim(),
        String(form.get('phone') || '').trim(),
      );
      if (!person.name) throw Error('Имя обязательно.');
      all.push(person);
      savePeople(all);
      m.remove();
      onCreated(person);
    } catch (error) {
      event.currentTarget.querySelector('[data-error]').textContent = error.message;
    }
  });

  return m;
}
