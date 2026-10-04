import { text, dataAttributes } from './html.js';

function headerControl(slot = {}, role = '') {
  if (!slot || slot.hidden) return `<div class="v2-header__slot v2-header__slot--${role} is-empty"></div>`;
  const label = text(slot.label || '');
  const aria = text(slot.aria || slot.label || role);
  const badge = Number(slot.badge || 0) > 0 ? `<span class="v2-header__badge">${Math.min(99, Number(slot.badge || 0))}</span>` : '';
  const image = String(slot.image || '').trim();
  const initials = text(slot.initials || (slot.label || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase());
  const kind = slot.kind || 'text';
  const variant = slot.variant === 'danger' ? 'danger' : (slot.variant === 'white' || slot.variant === 'secondary' ? 'white' : '');
  const variantClass = variant ? ` v2-header__control--${variant}` : '';
  const settingsTag = role === 'a' && slot.settingsTag
    ? '<span class="v2-header__settings-tag" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.06 3.8l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 9c.13.36.34.7.6 1 .28.3.67.47 1.1.5h.1v4h-.1a1.7 1.7 0 0 0-1.7.5Z"></path></svg></span>'
    : '';
  let body = label;
  if (kind === 'logo') {
    body = label;
  } else if (kind === 'avatar') {
    body = image
      ? `<span class="v2-header__avatar" style="--v2-avatar:url('${text(image)}');--v2-avatar-position:${text(slot.imagePosition || '50% 50%')}" aria-hidden="true"></span>`
      : `<span class="v2-header__avatar v2-header__avatar--initials" aria-hidden="true">${initials}</span>`;
  } else if (kind === 'chat') {
    body = '<span class="v2-header__icon v2-header__icon--chat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4c-4.7 0-8 2.8-8 6.7 0 2.5 1.4 4.6 3.8 5.8L7.2 20l3.6-2.1c.4.1.8.1 1.2.1 4.7 0 8-2.8 8-7.3S16.7 4 12 4Z"></path></svg></span>';
  } else if (kind === 'contacts') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.2"></circle><path d="M3.8 14.5c.7-2.1 1.8-3.1 3.2-3.1s2.5 1 3.2 3.1M13 7h7M13 12h7M13 17h7"></path></svg></span>';
  } else if (kind === 'attachment') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m8.5 12.5 6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.1-8.1"></path></svg></span>';
  } else if (kind === 'settings') {
    body = '<span class="v2-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path></svg></span>';
  } else if (kind === 'back') {
    body = '<span class="v2-header__back" aria-hidden="true">‹</span>';
  }
  return `<div class="v2-header__slot v2-header__slot--${role}"><button type="button" class="v2-header__control v2-header__control--${kind}${variantClass}"${dataAttributes(slot.data)} aria-label="${aria}"${slot.disabled ? ' disabled' : ''}>${body}${settingsTag}${badge}</button></div>`;
}

export function v2Header({ a = null, b = '', c = null, d = null } = {}) {
  const title = b && typeof b === 'object'
    ? `<button type="button" class="v2-header__title v2-header__title-control"${dataAttributes(b.data)} aria-label="${text(b.aria || b.label || '')}">${text(b.label || '')}</button>`
    : `<h1 class="v2-header__title">${text(b)}</h1>`;
  const headerClasses = ['v2-header', c && !c.hidden ? 'has-c' : '', d && !d.hidden ? 'has-d' : ''].filter(Boolean).join(' ');
  return `<header class="${headerClasses}" data-v2-header>
    ${headerControl(a, 'a')}
    ${title}
    ${headerControl(c, 'c')}
    ${headerControl(d, 'd')}
  </header>`;
}

function v2NavigationIcon(id = '') {
  const key = String(id || '').toLowerCase();
  const paths = {
    people: '<circle cx="8" cy="9" r="3"></circle><circle cx="16" cy="9" r="3"></circle><path d="M3 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5M12 20c.6-2.8 2.1-4.4 4.4-4.4 2.2 0 3.7 1.6 4.3 4.4"></path>',
    contacts: '<circle cx="8" cy="9" r="3"></circle><circle cx="16" cy="9" r="3"></circle><path d="M3 20c.7-3.2 2.4-5 5-5s4.3 1.8 5 5M12 20c.6-2.8 2.1-4.4 4.4-4.4 2.2 0 3.7 1.6 4.3 4.4"></path>',
    finance: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18M15 15h3"></path>',
    cash: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18M15 15h3"></path>',
    dds: '<path d="M4 6h16M4 12h16M4 18h16"></path><path d="m8 3-3 3 3 3M16 15l3 3-3 3"></path>',
    'income-expense': '<path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4"></path>',
    articles: '<path d="M5 5h14M5 10h14M5 15h9M5 20h9"></path>',
    special: '<path d="M4 8h16M4 16h16M8 4 4 8l4 4M16 12l4 4-4 4"></path>',
    'z-report': '<path d="M5 4h14L6 20h13"></path>',
    timetable: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path>',
    home: '<path d="m3 11 9-7 9 7v9h-6v-6H9v6H3Z"></path>',
    journal: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"></path><path d="M8 4v16"></path>',
    history: '<path d="M4 7h16M4 12h16M4 17h11"></path><circle cx="2.5" cy="7" r=".8"></circle><circle cx="2.5" cy="12" r=".8"></circle><circle cx="2.5" cy="17" r=".8"></circle>',
    profile: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4.4 3.7-7 8-7s7 2.6 8 7"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path>',
    service: '<path d="m14 6 4-4 4 4-4 4M3 21l9-9M8 16l3 3"></path>',
    'online-booking': '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18M8 15h8"></path>',
    communications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path>',
    integrations: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>',
    documents: '<path d="M6 3h9l4 4v14H6Z"></path><path d="M15 3v5h5M9 13h6M9 17h6"></path>',
    tags: '<path d="M3 12V4h8l10 10-8 8Z"></path><circle cx="8" cy="8" r="1"></circle>',
    day: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path>',
    month: '<path d="M5 20V11M10 20V6M15 20V9M20 20V3"></path>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"></path><circle cx="3.5" cy="6" r="1"></circle><circle cx="3.5" cy="12" r="1"></circle><circle cx="3.5" cy="18" r="1"></circle>',
  };
  const body = paths[key] || '<rect x="4" y="4" width="16" height="16" rx="3"></rect>';
  return `<span class="v2-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${body}</svg></span>`;
}

function v2NestedMark(count = 0) {
  const value = Math.max(0, Number(count || 0));
  if (!value) return '';
  return `<span class="v2-f-nested" aria-hidden="true"><i></i><i></i><i></i><b>${value}</b></span>`;
}

export function v2CardDeck(items = [], {
  axis = 'x',
  active = '',
  data = 'data-v2-deck-item',
  className = '',
  role = '',
  level = 'f',
} = {}) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 7);
  if (!values.length) return '';
  const resolvedAxis = axis === 'y' ? 'y' : 'x';
  const activeId = String(active || values[0]?.id || '0');
  const activeIndex = Math.max(0, values.findIndex((item, index) => String(item.id || index) === activeId));
  const classes = ['v2-card-deck', `v2-card-deck--${resolvedAxis}`, className].filter(Boolean).join(' ');
  const roleData = role ? ` data-v2-deck-role="${text(role)}"` : '';
  return `<div class="${text(classes)}" data-v2-card-deck data-v2-deck-axis="${resolvedAxis}" data-v2-deck-level="${text(level)}" data-v2-deck-count="${values.length}"${roleData}>${values.map((item, index) => {
    const id = String(item.id || index);
    const isActive = index === activeIndex;
    const childrenCount = Number(item.childrenCount || item.children || 0);
    const customData = data ? ` ${data}="${text(id)}"` : '';
    return `<button type="button" class="v2-card-deck__card${isActive ? ' is-active' : ''}" data-v2-card-item="${text(id)}"${customData} data-v2-card-index="${index}" aria-label="${text(item.aria || item.label || '')}"${isActive ? ' aria-current="true"' : ''}>${level === 'f' ? v2NestedMark(childrenCount) : ''}${v2NavigationIcon(item.icon || id)}<strong>${text(item.label || '')}</strong></button>`;
  }).join('')}</div>`;
}

export function v2Shell({
  header = '',
  body = '',
  deck = '',
  eDeck = '',
  className = '',
  deckOpen = false,
  eOpen = false,
  zEnter = false,
  zData = 'data-v2-z',
} = {}) {
  const classes = ['v2-app', deck ? 'v2-app--with-deck' : '', eDeck ? 'has-e-deck' : '', deckOpen ? 'is-deck-open' : '', deckOpen && eOpen && eDeck ? 'is-e-open' : '', zEnter && !deckOpen ? 'is-z-entering' : '', className].filter(Boolean).join(' ');
  const feDeck = deck || eDeck ? `<div class="v2-fe-deck" data-v2-fe>${deck}${eDeck}</div>` : '';
  return `<section class="${classes}" data-v2-app>
    ${header}
    <div class="v2-app__stage">
      ${feDeck}
      <div class="v2-front" data-v2-front>
        <main class="v2-z" ${zData}>
${body}
</main>
      </div>
      <div class="v2-edge-swipe-zone" data-v2-edge-swipe aria-hidden="true"></div>
    </div>
  </section>`;
}

export function v2Section(title = '', content = '', { className = '' } = {}) {
  return `<section class="v2-section ${text(className)}"><h2 class="v2-section__title">${text(title)}</h2><div class="v2-section__content">${content}</div></section>`;
}

export function v2HorizontalRail(content = '', { className = '' } = {}) {
  return `<div class="v2-rail ${text(className)}">${content}</div>`;
}

export function v2RailCard({ title = '', subtitle = '', meta = '', data = '', aria = '', className = '' } = {}) {
  return `<button type="button" class="v2-rail-card ${text(className)}"${dataAttributes(data)} aria-label="${text(aria || title)}"><strong>${text(title)}</strong>${subtitle ? `<span>${text(subtitle)}</span>` : ''}${meta ? `<small>${text(meta)}</small>` : ''}</button>`;
}

export function v2Sticker({
  eyebrow = '',
  title = '',
  body = '',
  action = '',
  className = '',
  data = 'data-v2-sticker',
  closeData = '',
  closeAria = 'Закрыть',
} = {}) {
  const close = closeData
    ? `<button type="button" class="v2-sticker__close" ${String(closeData).trim()} aria-label="${text(closeAria)}">×</button>`
    : '';
  return `<section class="v2-sticker-screen ${text(className)}" ${data}>
    <article class="v2-sticker">
      ${close}
      ${eyebrow ? `<div class="v2-sticker__eyebrow">${text(eyebrow)}</div>` : ''}
      ${title ? `<h1 class="v2-sticker__title">${text(title)}</h1>` : ''}
      <div class="v2-sticker__body">${body}</div>
      ${action ? `<div class="v2-sticker__action">${action}</div>` : ''}
    </article>
  </section>`;
}
