import { button } from '../buttons/index.js';
import { modal, mountModal } from '../modals/index.js';

const STEP_TITLES = {
  workplace: 'Рабочее пространство',
  procedures: 'Процедуры',
  date: 'Дата',
  time: 'Время',
  person: 'Человек',
  confirmation: 'Подтверждение',
};

export function recordCreationStepTitle(step = '') {
  return STEP_TITLES[String(step || '')] || 'Запись';
}

export function openRecordCreationOwner({ onCancel = () => {} } = {}) {
  const layer = mountModal(document.body, modal(
    `<div class="record-creation-flow" data-record-creation-flow>
      <div class="modal-title record-creation-flow__title"><h2 data-record-creation-title>Запись</h2></div>
      <div class="record-creation-flow__body" data-record-creation-body></div>
      <div class="record-creation-flow__action" data-record-creation-action></div>
    </div>`,
    {
      variant: 'x',
      surface: 'app',
      title: 'Запись',
      className: 'record-creation-x',
      xRole: 'editor',
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
    title = recordCreationStepTitle(step),
    body = '',
    action = null,
  } = {}) => {
    if (!bodyHost || !actionHost || !titleHost) return null;
    layer.dataset.recordCreationStep = String(step || '');
    titleHost.textContent = String(title || recordCreationStepTitle(step));
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
