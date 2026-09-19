import { updateAccount } from '../core/account/index.js';
import {
  accordion,
  button,
  collectLinks,
  collectRepeatedField,
  escapeHtml,
  field,
  initAccordions,
  initCalendar,
  initLinks,
  initPhotoField,
  initRepeatedFields,
  links,
  modal,
  mountModal,
  phoneField,
  photoField,
  repeatedField,
  select,
} from '../ui/ui.js';

function profileData(account = {}) {
  return account.profileData && typeof account.profileData === 'object' ? account.profileData : {};
}

function unique(values = [], limit = 5) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))].slice(0, limit);
}

function dateParts(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day, date };
}

function birthDateLabel(value = '') {
  const parts = dateParts(value);
  return parts ? `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}` : 'Выберите дату';
}

function birthDateField(value = '') {
  return `<label class="field" data-client-birth-date><span>Дата рождения</span><button type="button" class="ui-select__control" data-client-birth-open><span class="ui-select__value">${escapeHtml(birthDateLabel(value))}</span><span class="ui-select__chevron" aria-hidden="true">⌄</span></button><input type="hidden" name="birthDate" value="${escapeHtml(String(value || ''))}" data-client-birth-value></label>`;
}

function yearOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 111 }, (_, index) => {
    const year = current - index;
    return { value: String(year), label: String(year) };
  });
}

function openBirthDatePicker(host) {
  const hidden = host?.querySelector('[data-client-birth-value]');
  if (!hidden) return;
  const current = dateParts(hidden.value);
  const today = new Date();
  let displayed = current?.date || new Date(today.getFullYear() - 30, today.getMonth(), 1);
  let selectedValue = current ? hidden.value : '';
  const content = `<div class="form-grid"><div data-client-birth-year></div><div data-client-birth-calendar></div>${selectedValue ? button('Очистить дату', { variant: 'secondary', data: 'data-client-birth-clear' }) : ''}</div>`;
  const layer = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app', title: 'Дата рождения' }));
  if (!layer) return;
  const yearHost = layer.querySelector('[data-client-birth-year]');
  const calendarHost = layer.querySelector('[data-client-birth-calendar]');
  if (!yearHost || !calendarHost) return;

  const setYearControl = () => {
    yearHost.innerHTML = select({
      label: 'Год',
      name: 'clientBirthYear',
      value: String(displayed.getFullYear()),
      options: yearOptions(),
      aria: 'Год рождения',
    });
    yearHost.querySelector('[name="clientBirthYear"]')?.addEventListener('change', (event) => {
      const year = Number(event.target.value);
      if (!Number.isInteger(year)) return;
      displayed = new Date(year, displayed.getMonth(), 1);
      mountCalendar();
    });
  };

  const commit = (value) => {
    if (!dateParts(value) || value > `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`) return;
    hidden.value = value;
    const visible = host.querySelector('.ui-select__value');
    if (visible) visible.textContent = birthDateLabel(value);
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    layer.remove();
  };

  const mountCalendar = () => {
    initCalendar(calendarHost, {
      selectedValue,
      month: new Date(displayed.getFullYear(), displayed.getMonth(), 1),
      onMonthChange: (month) => {
        displayed = month;
        setYearControl();
      },
      onDateSelect: (value) => {
        selectedValue = value;
        commit(value);
      },
    });
  };

  setYearControl();
  mountCalendar();
  layer.querySelector('[data-client-birth-clear]')?.addEventListener('click', () => {
    hidden.value = '';
    const visible = host.querySelector('.ui-select__value');
    if (visible) visible.textContent = 'Выберите дату';
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    layer.remove();
  });
}

function initBirthDate(root) {
  root.querySelectorAll('[data-client-birth-date]').forEach((host) => {
    host.querySelector('[data-client-birth-open]')?.addEventListener('click', () => openBirthDatePicker(host));
  });
}

function editorMarkup(account = {}) {
  const profile = profileData(account);
  return `<form data-client-personal-form>
    ${accordion([{
      title: 'Личные данные',
      content: `<div class="form-grid">
        ${photoField({ name: 'photo', value: profile.photo || '' })}
        ${field({ label: 'Имя', name: 'name', value: account.name || '', required: true, autocomplete: 'given-name' })}
        ${field({ label: 'Фамилия', name: 'surname', value: account.surname || '', autocomplete: 'family-name' })}
        ${phoneField({ label: 'Телефон', name: 'phone', value: account.phone || '', required: true })}
        ${repeatedField({ label: 'Дополнительные телефоны', name: 'additionalPhone', values: profile.phones || [], type: 'tel', addLabel: '+ Телефон', showEmptyRow: false })}
        ${field({ label: 'Email', name: 'email', value: account.email || '', type: 'email', readonly: true })}
        ${repeatedField({ label: 'Дополнительные email', name: 'additionalEmail', values: profile.emails || [], type: 'email', placeholder: 'name@example.com', addLabel: '+ Email', showEmptyRow: false })}
        ${field({ label: 'Telegram', name: 'telegram', value: profile.telegram || '', placeholder: '@username', maxlength: 100 })}
        ${select({
          label: 'Пол',
          name: 'gender',
          value: profile.gender || '',
          options: [
            { value: '', label: 'Не указан' },
            { value: 'male', label: 'Мужской' },
            { value: 'female', label: 'Женский' },
          ],
        })}
        ${birthDateField(profile.birthDate || '')}
        <div class="array-group"><span class="array-label">Ссылки</span>${links({ links: Array.isArray(profile.links) ? profile.links : [], name: 'clientProfileLinks' })}</div>
      </div>`,
    }], { openFirst: true })}
    <div class="form-error" data-client-personal-error role="alert"></div>
    ${button('Сохранить', { type: 'submit' })}
  </form>`;
}

export function openClientPersonalData(state, { onSaved } = {}) {
  const layer = mountModal(document.body, modal(editorMarkup(state.account || {}), { variant: 'medium', surface: 'app', title: 'Личные данные' }));
  if (!layer) return null;
  initAccordions(layer);
  initPhotoField(layer);
  initRepeatedFields(layer);
  initLinks(layer);
  initBirthDate(layer);

  const form = layer.querySelector('[data-client-personal-form]');
  const errorNode = layer.querySelector('[data-client-personal-error]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (errorNode) errorNode.textContent = '';
    try {
      const currentProfile = profileData(state.account || {});
      const account = await updateAccount(state.tenantId, {
        name: data.get('name'),
        surname: data.get('surname'),
        phone: data.get('phone'),
        profileData: {
          ...currentProfile,
          photo: String(data.get('photo') || ''),
          phones: unique(collectRepeatedField(form, 'additionalPhone')),
          emails: unique(collectRepeatedField(form, 'additionalEmail').map((value) => String(value).toLowerCase())),
          telegram: String(data.get('telegram') || '').trim(),
          gender: String(data.get('gender') || ''),
          birthDate: String(data.get('birthDate') || ''),
          links: collectLinks(form, 'clientProfileLinks').slice(0, 8),
        },
      });
      state.account = account;
      layer.remove();
      await onSaved?.(account);
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось сохранить данные';
      if (submit) submit.disabled = false;
    }
  });
  return layer;
}
