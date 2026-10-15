import { button } from '../buttons/index.js';
import { modal, mountModal } from '../modals/index.js';
import { timeSlots } from '../time/index.js';

const STEP_TITLES = {
  workplace: 'Выбор пространства',
  procedures: 'Выбор процедур',
  date: 'Выбор даты',
  time: 'Выбор времени',
  person: 'Выбор клиента',
  confirmation: 'Подтверждение записи',
  'break-end': 'Выбор времени До',
  'break-confirmation': 'Подтверждение перерыва',
};

const TITLE_ALIASES = new Map([
  ['Выбор времени начала', 'Выбор времени С'],
  ['Выбор времени до скольки', 'Выбор времени До'],
]);

export function recordCreationStepTitle(step = '') {
  return STEP_TITLES[String(step || '')] || 'Запись';
}

function resolveRecordCreationTitle(step = '', title = '') {
  const explicit = String(title || '');
  if (TITLE_ALIASES.has(explicit)) return TITLE_ALIASES.get(explicit);
  return explicit || recordCreationStepTitle(step);
}

export function recordCreationTimeRows(items = [], {
  data = 'data-record-creation-time',
  empty = 'Времени нет.',
  selected = '',
} = {}) {
  const values = (Array.isArray(items) ? items : [])
    .map((item) => typeof item === 'object' ? { ...item } : { value: String(item || ''), label: String(item || '') })
    .map((item) => ({
      ...item,
      value: String(item.value ?? item.from ?? item.label ?? ''),
      label: String(item.label ?? item.value ?? item.from ?? ''),
    }))
    .filter((item) => item.value);
  if (!values.length) return `<div class="muted">${String(empty || 'Времени нет.')}</div>`;

  const groups = new Map();
  values.forEach((item) => {
    const hour = String(item.value).split(':')[0] || '';
    if (!groups.has(hour)) groups.set(hour, []);
    groups.get(hour).push(item);
  });

  return `<div class="record-creation-time-rows">${[...groups.entries()].map(([hour, slots]) => `
    <section class="record-creation-time-row">
      ${timeSlots({
        values: slots,
        selected,
        data,
        ariaLabel: `Выбор времени ${hour}:00`,
        className: 'time-slots--hour-rows',
      })}
    </section>`).join('')}</div>`;
}

export function openRecordCreationOwner({ onCancel = () => {} } = {}) {
  const layer = mountModal(document.body, modal(
    `<div class="record-creation-flow" data-record-creation-flow>
      <div class="modal-title record-creation-flow__title"><h2 data-record-creation-title>Запись</h2></div>
      <div class="record-creation-flow__body" data-record-creation-body></div>
      <div class="record-creation-flow__action" data-record-creation-action></div>
    </div>`,
    {
      variant: 'q',
      surface: 'app',
      title: 'Запись',
      className: 'record-creation-q',
    },
  ));
  if (!layer) return null;

  let committed = false;
  const originalClose = layer.v2Close?.bind(layer) || (() => layer.remove());
  layer.v2Close = () => {
    if (!layer.isConnected) return;
    const cancelled = !committed;
    originalClose();
    if (cancelled) onCancel?.();
  };

  const titleHost = layer.querySelector('[data-record-creation-title]');
  const bodyHost = layer.querySelector('[data-record-creation-body]');
  const actionHost = layer.querySelector('[data-record-creation-action]');

  const render = ({
    step = '',
    title = '',
    body = '',
    action = null,
  } = {}) => {
    if (!bodyHost || !actionHost || !titleHost) return null;
    layer.dataset.recordCreationStep = String(step || '');
    titleHost.textContent = resolveRecordCreationTitle(step, title);
    bodyHost.innerHTML = body;
    actionHost.innerHTML = action?.label
      ? button(action.label, {
          data: action.data || 'data-record-creation-primary',
          disabled: Boolean(action.disabled),
          variant: action.variant || 'primary',
        })
      : '';
    return {
      layer,
      body: bodyHost,
      action: actionHost.querySelector('button'),
    };
  };

  return {
    layer,
    render,
    commit() {
      committed = true;
      layer.v2Close?.();
    },
    close() {
      layer.v2Close?.();
    },
    isOpen() {
      return Boolean(layer.isConnected);
    },
  };
}
