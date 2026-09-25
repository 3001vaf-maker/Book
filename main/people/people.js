import {
  button,
  collectLinks,
  collectRepeatedEntries,
  collectTags,
  emptyState,
  entityCard,
  escapeHtml,
  field,
  initLinks,
  initMonthDayPickers,
  initPhotoField,
  initRepeatedFields,
  initTags,
  initUEI,
  links,
  listEntries,
  listEntry,
  miniCard,
  modal,
  monthDayPicker,
  mountModal,
  mountV2ZLayer,
  page,
  photoField,
  repeatedField,
  select,
  shortDateTime,
  tags,
  uei,
  v2HorizontalRail,
  v2RailCard,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';
import { applyUEI, detachUEI, getMembers, getOptions, getUEI } from '../../core/uei.js';
import { getTags } from '../../settings/tags/data.js';
import { getDocuments } from '../../settings/documents/data.js';
import { getConsents } from '../../settings/documents/consents.js';
import { createPerson, getAllPeople, getPeople, savePeople } from './data.js';
import { bindPersonCreateForm, personCreateForm } from './create.js';
import { getPersonMetadata, formatPersonVisitDate } from './metadata.js';
import { personDisplay } from './presentation.js';
import { getPeopleSortMode, setPeopleSortMode } from './view-state.js';
import { canUseRealPersonalData } from '../../core/access.js';

const name = (person) => [person?.name, person?.surname].filter(Boolean).join(' ').trim() || 'Без имени';
const money = (value) => new Intl.NumberFormat('ru-RU').format(Number(value || 0)) + ' ₽';
const initial = (person) => name(person).slice(0, 1).toUpperCase() || '?';
const initials = (person) => [person?.name, person?.surname].filter(Boolean).slice(0, 2).map((part) => String(part).slice(0, 1).toUpperCase()).join('') || '?';

function notifyContext() {
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function sortItems(items, mode) {
  return [...items].sort((a, b) => {
    if (mode.startsWith('name')) {
      const compared = name(a).localeCompare(name(b), 'ru');
      return mode === 'nameDesc' ? -compared : compared;
    }
    const av = a.lastVisit ? Date.parse(a.lastVisit) : 0;
    const bv = b.lastVisit ? Date.parse(b.lastVisit) : 0;
    return mode === 'lastDesc' ? bv - av : av - bv;
  });
}

function sortOptions() {
  return [
    ['nameAsc', 'Имя ↑'],
    ['nameDesc', 'Имя ↓'],
    ['lastAsc', 'Последнее посещение ↑'],
    ['lastDesc', 'Последнее посещение ↓'],
  ].map(([value, label]) => ({ value, label }));
}

function consentStatus(fact) {
  if (!fact) return 'Не подписано';
  if (fact.status === 'revoked') return 'Отозвано';
  if (fact.status === 'declined') return 'Не подписано';
  return 'Подписано';
}

function consentMoment(fact) {
  const value = fact?.eventAt || fact?.revokedAt || fact?.acceptedAt || fact?.createdAt || '';
  return shortDateTime(value, '—');
}

function consentSource(source) {
  if (source === 'online-booking') return 'Онлайн-запись';
  if (source === 'online-booking-registration') return 'Регистрация в системе';
  if (source === 'manual') return 'Вручную';
  return source || '—';
}

function consentEventTime(fact) {
  const value = Date.parse(fact?.eventAt || fact?.revokedAt || fact?.acceptedAt || fact?.createdAt || 0);
  return Number.isFinite(value) ? value : 0;
}

function canonicalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

function personIdentityMembers(person) {
  const all = getAllPeople();
  if (!person?.uei) return [person];
  const members = all.filter((item) => item.uei === person.uei);
  return members.length ? members : [person];
}

function currentConsentFacts(person, documentId) {
  const members = personIdentityMembers(person);
  const accounts = new Set(members.flatMap((item) => Array.isArray(item.accounts) ? item.accounts : []).map(String).filter(Boolean));
  const phones = new Set(members.flatMap((item) => Array.isArray(item.phones) ? item.phones : []).map(canonicalPhone).filter(Boolean));
  const emails = new Set(members.flatMap((item) => Array.isArray(item.emails) ? item.emails : []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  const telegrams = new Set(members.flatMap((item) => Array.isArray(item.telegrams) ? item.telegrams : []).map((value) => String(value || '').trim()).filter(Boolean));
  const relevant = getConsents().filter((fact) => {
    if (fact.documentId !== documentId) return false;
    if (documentId === 'pdn-consent') return fact.subjectType === 'ACCOUNT' && accounts.has(String(fact.subjectKey || ''));
    if (documentId !== 'messages-consent' || fact.subjectType !== 'CONTACT_POINT') return false;
    if (fact.contactType === 'PHONE') return phones.has(canonicalPhone(fact.contactValue));
    if (fact.contactType === 'EMAIL') return emails.has(String(fact.contactValue || '').trim().toLowerCase());
    if (fact.contactType === 'TELEGRAM') return telegrams.has(String(fact.contactValue || '').trim());
    return false;
  });
  const latestBySubject = new Map();
  for (const fact of relevant) {
    const key = `${fact.subjectType}:${fact.subjectKey}:${fact.documentId}`;
    const previous = latestBySubject.get(key);
    if (!previous || consentEventTime(fact) > consentEventTime(previous)) latestBySubject.set(key, fact);
  }
  return [...latestBySubject.values()];
}

function personConsentState(person, documentId) {
  const facts = currentConsentFacts(person, documentId);
  const active = facts.filter((fact) => fact.status === 'accepted').sort((a, b) => consentEventTime(b) - consentEventTime(a));
  const inactive = facts.filter((fact) => fact.status !== 'accepted').sort((a, b) => consentEventTime(b) - consentEventTime(a));
  return { active: active.length > 0, fact: active[0] || inactive[0] || null, count: facts.length };
}

function openPersonConsent(root, person, documentId) {
  const documentItem = getDocuments().find((item) => item.id === documentId);
  const state = personConsentState(person, documentId);
  const fact = state.fact;
  const title = documentItem?.title || 'Согласие';
  const status = state.active ? 'Подписано' : consentStatus(fact);
  const version = fact?.documentVersion || documentItem?.version || 1;
  const scope = documentId === 'messages-consent' && state.count > 1
    ? `<div><span>Контакты</span><strong>${escapeHtml(state.count)}</strong></div>`
    : '';
  const html = `<div class="modal-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(status)}</p></div>
    <div class="entity-details">
      <div><span>Статус</span><strong>${escapeHtml(status)}</strong></div>
      <div><span>Версия</span><strong>${escapeHtml(version)}</strong></div>
      <div><span>Дата</span><strong>${escapeHtml(consentMoment(fact))}</strong></div>
      <div><span>Источник</span><strong>${escapeHtml(consentSource(fact?.source))}</strong></div>
      ${scope}
    </div>
    ${fact ? '' : '<p class="muted">Подтверждение отсутствует.</p>'}`;
  mountModal(root, modal(html, { title, variant: 'standard', surface: 'app' }));
}

function filterPeople(items, query = '') {
  const needle = String(query || '').trim().toLocaleLowerCase('ru');
  if (!needle) return items;
  return items.filter((person) => {
    const display = personDisplay(person);
    return display.name.toLocaleLowerCase('ru').includes(needle)
      || String(display.uei || '').toLocaleLowerCase('ru').includes(needle);
  });
}

function listMarkup(items, query = '') {
  if (!items.length) {
    return query
      ? emptyState('Ничего не найдено', 'Проверьте имя или UEI.')
      : emptyState('Клиентов пока нет', 'Добавьте человека кнопкой «+».');
  }
  return listEntries(items.map((person) => {
    const display = personDisplay(person);
    return listEntry({
      overline: display.uei,
      title: display.name,
      subtitle: display.phone,
      image: person.photo || '',
      initial: initial(person),
      interactive: true,
      data: `data-person="${escapeHtml(person.key)}"`,
      aria: `Открыть ${display.name}`,
    });
  }));
}

function refreshPeopleList(root) {
  const host = root.querySelector('[data-people-list-host]');
  if (!host) return;
  const query = root.querySelector('[data-people-search]')?.value || '';
  const items = filterPeople(sortItems(getPeople(), getPeopleSortMode()), query);
  host.innerHTML = listMarkup(items, query);
  host.querySelectorAll('[data-person]').forEach((node) => {
    node.addEventListener('click', () => openPersonOverview(root, node.dataset.person, root.peopleOptions || {}));
  });
}

function listContext(count) {
  return workspaceHeaderContext({
    title: 'Клиенты',
    a: {
      kind: 'text',
      label: String(count),
      data: 'data-people-list-settings',
      aria: `Клиентов: ${count}. Сортировка и Excel`,
    },
  });
}

export function renderPeople(root, options = {}) {
  root.peopleOptions = options;
  const count = getPeople().length;
  root.innerHTML = page([
    listContext(count),
    `<section class="people-z1">
      <div class="people-search">
        ${field({ name: 'peopleSearch', type: 'search', placeholder: 'Поиск по имени или UEI', autocomplete: 'off', data: 'data-people-search' })}
      </div>
      <div class="people-search-divider" aria-hidden="true"></div>
      <div class="people-list-host" data-people-list-host></div>
    </section>`,
    button('+', {
      className: 'v2-primary-source-only',
      data: 'data-add data-v2-primary-action data-v2-primary-label="+"',
      aria: 'Добавить клиента',
    }),
  ]);
  refreshPeopleList(root);
  root.querySelector('[data-people-search]')?.addEventListener('input', () => refreshPeopleList(root));
  root.querySelector('[data-people-list-settings]')?.addEventListener('click', () => openListSettings(root, options));
  root.querySelector('[data-add]')?.addEventListener('click', () => openCreateZ2(root, options));
}

function openListSettings(root, options = {}) {
  const allowReal = canUseRealPersonalData();
  const content = `<div class="people-list-settings">
    ${select({ label: 'Сортировка', value: getPeopleSortMode(), options: sortOptions(), aria: 'Сортировка', data: 'data-people-sort-settings' })}
    <div class="people-list-settings__actions">
      ${button('Выгрузить', { variant: 'secondary', data: 'data-export' })}
      ${button('Загрузить', { variant: 'secondary', data: 'data-import', disabled: !allowReal })}
      ${button('Шаблон', { variant: 'secondary', data: 'data-template' })}
      <input class="file-input" type="file" accept=".csv,text/csv" data-file>
    </div>
    ${allowReal ? '' : '<p class="muted">Импорт реальных персональных данных недоступен в текущем режиме.</p>'}
  </div>`;
  const layer = mountModal(root, modal(content, { title: 'Клиенты', variant: 'quick', surface: 'app' }));
  if (!layer) return;
  layer.querySelector('[data-people-sort-settings]')?.addEventListener('change', (event) => {
    setPeopleSortMode(event.target.value);
    refreshPeopleList(root);
  });
  layer.querySelector('[data-export]')?.addEventListener('click', () => downloadCsv(false));
  layer.querySelector('[data-template]')?.addEventListener('click', () => downloadCsv(true));
  layer.querySelector('[data-import]')?.addEventListener('click', () => layer.querySelector('[data-file]')?.click());
  layer.querySelector('[data-file]')?.addEventListener('change', (event) => {
    importCsv(event.target.files?.[0], () => {
      layer.v2Close?.();
      renderPeople(root, options);
    });
  });
}

function downloadCsv(template) {
  const headers = ['Имя', 'Фамилия', 'Телефон', 'Email'];
  const rows = template ? [] : getPeople().map((person) => [person.name, person.surname, person.phones?.[0], person.emails?.[0]]);
  const text = '\uFEFF' + [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = template ? 'шаблон-люди.csv' : 'люди.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function importCsv(file, onDone) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = String(reader.result)
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(';').map((cell) => cell.replace(/^"|"$/g, '').replaceAll('""', '"')));
    const all = getAllPeople();
    rows.slice(1).forEach(([firstName, surname, phone, email]) => {
      if (!firstName || !phone) return;
      const person = createPerson(firstName, surname, phone);
      if (email) person.emails = [email];
      all.push(person);
    });
    savePeople(all);
    onDone?.();
  };
  reader.readAsText(file, 'utf-8');
}

function openCreateZ2(root, options = {}) {
  const layer = mountV2ZLayer(root, v2ZLayer(page([
    workspaceHeaderContext({ title: 'Новый клиент', hideD: true }),
    personCreateForm(),
  ]), { className: 'people-create-layer' }), { stack: true });
  if (!layer) return null;
  const submit = layer.querySelector('[data-person-create-form] button[type="submit"]');
  if (submit) {
    submit.classList.add('v2-primary-source-only');
    submit.dataset.v2PrimaryAction = '';
    submit.dataset.v2PrimaryLabel = 'Сохранить';
  }
  bindPersonCreateForm(layer, {
    onCreated: (person) => {
      layer.v2Close?.();
      renderPeople(root, options);
      openPersonOverview(root, person.key, options);
    },
  });
  notifyContext();
  return layer;
}

function personContext(person) {
  return workspaceHeaderContext({
    title: name(person),
    a: {
      kind: 'avatar',
      image: person.photo || '',
      initials: initials(person),
      data: 'data-person-settings',
      aria: `Настройки ${name(person)}`,
    },
    d: {
      kind: 'chat',
      data: 'data-person-direct-chat',
      aria: `Чат с ${name(person)}`,
    },
  });
}

function bindPersonContext(root, person, options = {}, { onIdentityChange = null } = {}) {
  root.querySelector('[data-person-settings]')?.addEventListener('click', () => {
    openPersonSettings(root, person.key, {
      onIdentityChange: (nextKey) => onIdentityChange?.(nextKey),
    });
  });
  root.querySelector('[data-person-direct-chat]')?.addEventListener('click', () => {
    options.onDirectChat?.(person.key);
  });
}

function metricRail(person) {
  const meta = getPersonMetadata(person.key);
  const items = [
    { value: String(meta.recordCount), label: 'записей' },
    { value: money(meta.paidTotal), label: 'сумма' },
    { value: formatPersonVisitDate(meta.lastVisit), label: 'посещение' },
  ];
  return v2HorizontalRail(items.map((item) => v2RailCard({
    title: item.value,
    subtitle: item.label,
    className: 'people-metric-card',
  })).join(''), { className: 'people-metrics' });
}

function overviewCard(person) {
  const display = personDisplay(person);
  return entityCard({
    id: display.uei,
    title: display.name,
    subtitle: display.phone,
    image: person.photo || '',
    initial: initial(person),
    interactive: true,
    data: 'data-person-card',
    className: 'entity-card--hero',
    aria: `Открыть данные ${display.name}`,
  });
}

function renderPersonOverview(layer, baseRoot, key, options = {}) {
  const person = getAllPeople().find((item) => item.key === key);
  if (!person) {
    layer.v2Close?.();
    renderPeople(baseRoot, options);
    return;
  }
  layer.innerHTML = page([
    personContext(person),
    `<section class="people-overview">
      <div>${metricRail(person)}</div>
      <div class="people-card-wrap">${overviewCard(person)}</div>
    </section>`,
  ]);
  bindPersonContext(layer, person, options, {
    onIdentityChange: (nextKey) => renderPersonOverview(layer, baseRoot, nextKey || key, options),
  });
  layer.querySelector('[data-person-card]')?.addEventListener('click', () => {
    openPersonEdit(layer, baseRoot, person.key, options, {
      onSaved: () => renderPersonOverview(layer, baseRoot, person.key, options),
      onDeleted: () => {
        layer.v2Close?.();
        renderPeople(baseRoot, options);
      },
    });
  });
  notifyContext();
}

function openPersonOverview(root, key, options = {}) {
  if (!key) return null;
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'people-overview-layer' }), {
    stack: true,
    onClose: options.onClose || null,
  });
  if (!layer) return null;
  renderPersonOverview(layer, root, key, options);
  return layer;
}

export function openPerson({ root = document.body, key, onClose, onDirectChat } = {}) {
  return openPersonOverview(root, key, { onClose, onDirectChat });
}

function memberPeople(person, all) {
  const members = getMembers(person.uei);
  if (members.length <= 1) return [person];
  const ids = members.map((member) => member.startsWith('person:') ? member.slice(7) : member);
  return ids.map((id) => all.find((item) => item.key === id)).filter(Boolean);
}

function businessEntries(person, all, fieldName) {
  const people = memberPeople(person, all);
  const entries = [];
  const seen = new Set();
  for (const member of people) {
    for (const value of Array.isArray(member[fieldName]) ? member[fieldName] : []) {
      const text = String(value ?? '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      entries.push({ value: text, source: member.key });
    }
  }
  return entries;
}

function contactAnchor(person) {
  const telegram = (person.telegrams || []).map((value) => String(value || '').trim()).find(Boolean);
  if (telegram) return { value: person.key, label: telegram };
  const phone = (person.phones || []).map((value) => String(value || '').trim()).find(Boolean);
  if (phone) return { value: person.key, label: phone };
  const email = (person.emails || []).map((value) => String(value || '').trim()).find(Boolean);
  if (email) return { value: person.key, label: email };
  return null;
}

function hasContact(person) {
  return Boolean(contactAnchor(person));
}

function ueiData(person, all) {
  const current = person.uei || getUEI('person', person.key) || '';
  const existing = getOptions('person', person.key);
  const members = getMembers(current);
  const detachable = members.map((member) => {
    const id = member.startsWith('person:') ? member.slice(7) : member;
    const item = all.find((candidate) => candidate.key === id);
    return item ? contactAnchor(item) : null;
  }).filter(Boolean);
  return {
    value: current,
    existing,
    detachable,
    memberCount: members.length,
    showApply: false,
  };
}

function settingsCards(person) {
  const pdn = personConsentState(person, 'pdn-consent');
  const messages = personConsentState(person, 'messages-consent');
  const members = person.uei ? getMembers(person.uei).length : 0;
  return `<div class="people-person-settings">
    ${miniCard({
      title: 'UEI',
      value: person.uei || 'Не присвоен',
      subtitle: members > 1 ? `Связано профилей: ${members}` : 'Идентификатор человека',
      interactive: true,
      data: 'data-person-uei-card',
      aria: 'Настроить UEI',
    })}
    ${miniCard({
      title: 'Согласия',
      rows: [
        { label: 'Согласие ПДН', checked: pdn.active, data: 'data-person-consent="pdn-consent"', aria: 'Открыть согласие ПДН' },
        { label: 'Согласие на рассылки', checked: messages.active, data: 'data-person-consent="messages-consent"', aria: 'Открыть согласие на рассылки' },
      ],
    })}
  </div>`;
}

function refreshPersonIdentityPresentation(modalRoot, key) {
  const person = getAllPeople().find((item) => item.key === key);
  const surface = modalRoot?.parentElement?.matches?.('[data-v2-z-layer]') ? modalRoot.parentElement : null;
  if (!person || !surface) return;
  const metrics = surface.querySelector('.people-metrics');
  if (metrics) metrics.outerHTML = metricRail(person);
  const id = surface.querySelector('[data-person-card] .entity-card__id');
  if (id) id.textContent = person.uei || '';
}

function bindSettingsCards(modalRoot, key, { onIdentityChange = null } = {}) {
  const person = getAllPeople().find((item) => item.key === key);
  if (!person) {
    modalRoot.v2Close?.();
    return;
  }
  const host = modalRoot.querySelector('[data-person-settings-host]');
  if (!host) return;
  host.innerHTML = settingsCards(person);
  host.querySelector('[data-person-uei-card]')?.addEventListener('click', () => {
    openPersonUeiQuick(modalRoot, person.key, (nextKey) => {
      if (nextKey && nextKey !== person.key) {
        modalRoot.v2Close?.();
        onIdentityChange?.(nextKey);
        return;
      }
      bindSettingsCards(modalRoot, person.key, { onIdentityChange });
      refreshPersonIdentityPresentation(modalRoot, person.key);
    });
  });
  host.querySelectorAll('[data-person-consent]').forEach((row) => {
    row.addEventListener('click', () => openPersonConsent(modalRoot, person, row.dataset.personConsent));
  });
}

function openPersonSettings(root, key, { onIdentityChange = null } = {}) {
  const layer = mountModal(root, modal('<div data-person-settings-host></div>', {
    title: 'Настройки клиента',
    variant: 'standard',
    surface: 'app',
  }));
  if (!layer) return null;
  bindSettingsCards(layer, key, { onIdentityChange });
  return layer;
}

function openPersonUeiQuick(root, key, onChanged = () => {}) {
  const all = getAllPeople();
  const person = all.find((item) => item.key === key);
  if (!person) return;
  const current = person.uei || getUEI('person', person.key) || '';
  const identifiers = [...(person.phones || []), ...(person.telegrams || []), ...(person.emails || [])];
  const layer = mountModal(root, modal(`<div class="people-uei-sheet">${uei(ueiData(person, all))}<div class="form-error" data-uei-error></div></div>`, {
    title: 'UEI',
    variant: 'quick',
    surface: 'app',
  }));
  if (!layer) return;
  initUEI(layer);
  let committing = false;

  const fail = (error) => {
    committing = false;
    const node = layer.querySelector('[data-uei-error]');
    if (node) node.textContent = error instanceof Error ? error.message : 'Не удалось изменить UEI';
  };

  const finish = (nextKey = key) => {
    if (committing) return;
    committing = true;
    try {
      savePeople(all);
      layer.v2Close?.();
      onChanged(nextKey);
    } catch (error) {
      fail(error);
    }
  };

  const assign = () => {
    if (committing) return;
    const value = String(layer.querySelector('[name="uei"]')?.value || '').trim();
    if (!value) return;
    try {
      applyUEI({
        entityType: 'person',
        entityId: key,
        currentUEI: current,
        value,
        linkValue: '',
        identifiers,
      });
      finish(key);
    } catch (error) {
      fail(error);
    }
  };

  const link = (linkValue) => {
    if (committing || !linkValue) return;
    try {
      if (!hasContact(person)) {
        const targetMembers = getMembers(linkValue);
        const targetOwner = targetMembers[0]?.startsWith('person:') ? targetMembers[0].slice(7) : targetMembers[0];
        savePeople(all.filter((item) => item.key !== person.key));
        committing = true;
        layer.v2Close?.();
        onChanged(targetOwner || key);
        return;
      }
      applyUEI({
        entityType: 'person',
        entityId: key,
        currentUEI: current,
        value: String(layer.querySelector('[name="uei"]')?.value || ''),
        linkValue,
        identifiers,
      });
      finish(key);
    } catch (error) {
      fail(error);
    }
  };

  const detach = (entityId) => {
    if (committing || !entityId) return;
    try {
      detachUEI({ entityType: 'person', entityId, uei: current, explicit: true });
      finish(key);
    } catch (error) {
      fail(error);
    }
  };

  const valueInput = layer.querySelector('[name="uei"]');
  valueInput?.addEventListener('input', () => {
    if (String(valueInput.value || '').trim().length === 4) assign();
  });
  valueInput?.addEventListener('change', assign);
  valueInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      assign();
    }
  });
  layer.querySelector('[name="ueiLink"]')?.addEventListener('change', (event) => link(event.target.value));
  layer.querySelector('[name="ueiDetach"]')?.addEventListener('change', (event) => detach(event.target.value));
}

function personDataFields(person, all) {
  return [
    v2Section('Личные данные', `<div class="form-grid">
      ${photoField({ name: 'photo', value: person.photo || '' })}
      ${field({ label: 'Имя', name: 'name', value: person.name, required: true })}
      ${field({ label: 'Фамилия', name: 'surname', value: person.surname })}
      ${select({ label: 'Пол', name: 'gender', value: person.gender || '', options: [
        { value: '', label: 'Не указан' },
        { value: 'female', label: 'Женский' },
        { value: 'male', label: 'Мужской' },
      ] })}
      ${monthDayPicker({ label: 'Дата рождения', name: 'birthDate', value: person.birthDate || '' })}
      ${field({ label: 'Скидка %', name: 'discountPercent', value: person.discountPercent || '', type: 'number', inputmode: 'decimal' })}
    </div>`),
    v2Section('Контактные данные',
      repeatedField({ label: 'Телефон', name: 'phones', values: businessEntries(person, all, 'phones'), type: 'tel' })
      + repeatedField({ label: 'Telegram', name: 'telegrams', values: businessEntries(person, all, 'telegrams') })
      + repeatedField({ label: 'Email', name: 'emails', values: businessEntries(person, all, 'emails'), type: 'email' })),
    v2Section('Ссылки', links({ links: person.links || [], name: 'person-links' })),
    v2Section('Ярлыки', tags({ tags: getTags(), selected: person.tags || [], name: 'person-tags' })),
  ].join('');
}

function formSnapshot(form) {
  if (!form) return '';
  return JSON.stringify([...new FormData(form).entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']));
}

function saveBusinessEntries(all, ownerKey, fieldName, entries, memberKeys) {
  const valuesBySource = new Map(memberKeys.map((key) => [key, []]));
  for (const entry of entries) {
    const source = memberKeys.includes(entry.source) ? entry.source : ownerKey;
    if (!valuesBySource.has(source)) valuesBySource.set(source, []);
    if (!valuesBySource.get(source).includes(entry.value)) valuesBySource.get(source).push(entry.value);
  }
  for (const key of memberKeys) {
    const person = all.find((item) => item.key === key);
    if (person) person[fieldName] = valuesBySource.get(key) || [];
  }
}

function savePersonData(root, key) {
  const all = getAllPeople();
  const person = all.find((item) => item.key === key);
  if (!person) throw new Error('Человек не найден');
  const memberKeys = getMembers(person.uei).map((member) => member.startsWith('person:') ? member.slice(7) : member);
  if (!memberKeys.length) memberKeys.push(key);
  person.name = root.querySelector('[name="name"]')?.value.trim() || person.name;
  person.surname = root.querySelector('[name="surname"]')?.value.trim() || '';
  person.photo = root.querySelector('[data-photo-value]')?.value || '';
  person.gender = root.querySelector('[name="gender"]')?.value || '';
  person.birthDate = root.querySelector('[name="birthDate"]')?.value || '';
  const rawDiscount = Number(String(root.querySelector('[name="discountPercent"]')?.value || '0').replace(',', '.'));
  person.discountPercent = Number.isFinite(rawDiscount) ? Math.max(0, Math.min(100, rawDiscount)) : 0;
  saveBusinessEntries(all, key, 'phones', collectRepeatedEntries(root, 'phones'), memberKeys);
  saveBusinessEntries(all, key, 'telegrams', collectRepeatedEntries(root, 'telegrams'), memberKeys);
  saveBusinessEntries(all, key, 'emails', collectRepeatedEntries(root, 'emails'), memberKeys);
  person.links = collectLinks(root, 'person-links');
  person.tags = collectTags(root, 'person-tags');
  savePeople(all);
  return getAllPeople().find((item) => item.key === key) || person;
}

function deletePersonByKey(key) {
  const all = getAllPeople();
  const person = all.find((item) => item.key === key);
  if (!person) return;
  const current = getUEI('person', key) || person.uei || '';
  if (current) detachUEI({ entityType: 'person', entityId: key, uei: current, explicit: false });
  savePeople(all.filter((item) => item.key !== key));
}

function confirmDelete(root, person, onDeleted) {
  const layer = mountModal(root, modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(name(person))} будет удалён.</p></div>
    <div class="modal-actions">
      ${button('Удалить', { variant: 'danger', data: 'data-confirm-delete' })}
      ${button('Отмена', { variant: 'secondary', data: 'data-cancel-delete' })}
    </div>`, { title: 'Удалить', variant: 'compact', surface: 'app' }));
  if (!layer) return;
  layer.querySelector('[data-cancel-delete]')?.addEventListener('click', () => layer.v2Close?.());
  layer.querySelector('[data-confirm-delete]')?.addEventListener('click', () => {
    deletePersonByKey(person.key);
    layer.v2Close?.();
    onDeleted?.();
  });
}

function openPersonEdit(parentLayer, baseRoot, key, options = {}, callbacks = {}) {
  const person = getAllPeople().find((item) => item.key === key);
  if (!person) return null;
  const all = getAllPeople();
  const layer = mountV2ZLayer(parentLayer, v2ZLayer(page([
    personContext(person),
    `<form class="people-edit-form" data-person-edit-form>
      ${personDataFields(person, all)}
      ${button('Удалить', {
        type: 'button',
        className: 'v2-primary-source-only ui-button--danger',
        data: 'data-person-z3-action data-v2-primary-action data-v2-primary-variant="danger"',
        aria: 'Удалить клиента',
      })}
      <div class="form-error" data-person-edit-error></div>
    </form>`,
  ]), { className: 'people-edit-layer' }), { stack: true });
  if (!layer) return null;

  initPhotoField(layer);
  initMonthDayPickers(layer);
  initLinks(layer);
  initTags(layer);
  initRepeatedFields(layer);

  const form = layer.querySelector('[data-person-edit-form]');
  const action = layer.querySelector('[data-person-z3-action]');
  const initialState = formSnapshot(form);

  const isDirty = () => formSnapshot(form) !== initialState;
  const syncAction = () => {
    const dirty = isDirty();
    if (!action) return;
    action.textContent = dirty ? 'Сохранить' : 'Удалить';
    action.classList.toggle('ui-button--danger', !dirty);
    action.dataset.v2PrimaryVariant = dirty ? '' : 'danger';
    action.setAttribute('aria-label', dirty ? 'Сохранить изменения' : 'Удалить клиента');
    notifyContext();
  };

  const save = () => {
    if (!isDirty()) return;
    try {
      savePersonData(layer, key);
      layer.v2Close?.();
      callbacks.onSaved?.();
    } catch (error) {
      const node = layer.querySelector('[data-person-edit-error]');
      if (node) node.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
    }
  };

  action?.addEventListener('click', () => {
    if (isDirty()) {
      save();
      return;
    }
    confirmDelete(layer, person, () => {
      layer.v2Close?.();
      callbacks.onDeleted?.();
    });
  });
  form?.addEventListener('input', syncAction);
  form?.addEventListener('change', syncAction);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });
  bindPersonContext(layer, person, options, {
    onIdentityChange: (nextKey) => {
      if (!nextKey || nextKey === key) return;
      layer.v2Close?.();
      renderPersonOverview(parentLayer, baseRoot, nextKey, options);
    },
  });
  syncAction();
  return layer;
}
