import { getWorkplaces } from '../settings/profile/workplaces/data.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { getDays } from '../core/day.js';
import { getClientCount } from '../main/clients/data.js';
import { actionBlock, button, escapeHtml, modal, mountModal } from '../ui/ui.js';

const COMPLETE_KEY = 'book.onboarding.complete.v2';
const LEGACY_STEP_KEY = 'book.onboarding.step.v2';
const STEP_KEY = 'book.onboarding.step.v3';
const DOCUMENTS_ACK_KEY = 'book.onboarding.documents.v1';

function infoModal(title, message, variant = 'compact') {
  return mountModal(document.body, modal(`<div class="modal-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`, { title, variant, surface: 'app' }));
}

const stages = [
  {
    id: 'profile',
    load: () => import('../settings/profile/profile.js'),
    render: (module, root, context) => module.render(root, () => {}, { onboarding: true, accountEmail: context.accountEmail }),
    ready: (module, root) => module.isOnboardingProfileReady(root),
    beforeNext: (module, root) => module.saveOnboardingProfile(root),
  },
  {
    id: 'procedures',
    load: () => import('../settings/service/procedures/procedures.js'),
    render(module, root) {
      module.render(root, () => {});
      if (!getProcedures().length) queueMicrotask(() => root.querySelector('[data-add-procedure]')?.click());
    },
    ready: () => getProcedures().some((procedure) => Array.isArray(procedure.workplaces) && procedure.workplaces.length > 0),
  },
  {
    id: 'documents',
    load: () => import('../settings/documents/documents.js'),
    render(module, root) {
      module.render(root, () => {});
      queueMicrotask(() => infoModal(
        'Документы и персональные данные',
        'Для обработки персональных данных необходимо законное основание. Book предлагает общие редактируемые шаблоны согласий, но они не заменяют юридическую проверку и могут не учитывать особенности вашей работы. Рекомендуем адаптировать документы и при необходимости обратиться к юристу.',
        'medium',
      ));
    },
    ready: () => true,
    beforeNext: () => {
      localStorage.setItem(DOCUMENTS_ACK_KEY, '1');
      return true;
    },
  },
  {
    id: 'wallets',
    load: () => import('../settings/wallets/wallets.js'),
    render(module, root) {
      module.render(root, () => {});
      queueMicrotask(() => infoModal('Кошелёк', 'В Book уже есть кошельки «Наличные» и «Безналичные». Если нужен свой кошелёк, создайте его кнопкой «+». На этом этапе ничего дополнительно заполнять не обязательно.'));
    },
    ready: () => true,
  },
  {
    id: 'timetable',
    load: () => import('../timetable/timetable.js'),
    render(module, root) {
      module.renderTimetable(root);
      queueMicrotask(() => infoModal('График работы', 'Минимально отметьте рабочие дни. Обратите внимание на кнопку рабочего пространства в заголовке: если у вас несколько рабочих пространств, выберите нужное и настройте график отдельно.', 'medium'));
    },
    ready: () => getDays().length > 0,
  },
  {
    id: 'clients',
    load: () => import('../main/clients/clients.js'),
    render(module, root) {
      module.renderClients(root);
      queueMicrotask(() => infoModal('Клиенты', 'Добавьте 1–3 клиентов, которые записаны на ближайшее время. Одного клиента можно создать кнопкой «+», список — загрузить через Excel. Это позволит сразу перейти к реальным записям в Журнале.', 'medium'));
    },
    ready: () => getClientCount() > 0,
  },
];

function readStep() {
  if (localStorage.getItem(COMPLETE_KEY) === '1' && localStorage.getItem(DOCUMENTS_ACK_KEY) !== '1') {
    return stages.findIndex((stage) => stage.id === 'documents');
  }

  const current = Number(localStorage.getItem(STEP_KEY));
  if (Number.isInteger(current) && current >= 0 && current < stages.length) return current;

  const legacy = Number(localStorage.getItem(LEGACY_STEP_KEY));
  if (Number.isInteger(legacy) && legacy >= 0 && legacy <= 4) {
    const migrated = legacy >= 2 ? legacy + 1 : legacy;
    localStorage.setItem(STEP_KEY, String(migrated));
    return migrated;
  }

  return 0;
}

function writeStep(index) {
  localStorage.setItem(STEP_KEY, String(index));
}

export function isOnboardingComplete() {
  return localStorage.getItem(COMPLETE_KEY) === '1' && localStorage.getItem(DOCUMENTS_ACK_KEY) === '1';
}

export async function renderOnboarding(root, { onComplete = () => {}, accountEmail = '' } = {}) {
  const stepIndex = readStep();
  const stage = stages[stepIndex];
  if (!stage) return;

  root.innerHTML = `<main class="app-content onboarding-view"><section class="onboarding-content" data-onboarding-content></section><div class="onboarding-actions" data-onboarding-actions>${actionBlock(button(stepIndex === stages.length - 1 ? 'Начать работу' : 'Продолжить', { data: 'data-onboarding-next' }))}</div></main>`;
  const content = root.querySelector('[data-onboarding-content]');
  const nextButton = root.querySelector('[data-onboarding-next]');
  const module = await stage.load();
  stage.render(module, content, { accountEmail });

  let profileWorkplaceNoticeShown = false;
  let procedureWorkplaceNoticeShown = false;

  const syncNext = () => {
    const ready = Boolean(stage.ready?.(module, content));
    if (nextButton) nextButton.disabled = !ready;

    if (stage.id === 'profile' && !profileWorkplaceNoticeShown && module.isOnboardingProfileIdentityReady?.(content) && getWorkplaces().length === 0) {
      profileWorkplaceNoticeShown = true;
      infoModal('Рабочее пространство', 'Добавьте хотя бы одно рабочее пространство, чтобы корректно продолжить работу. Это может быть любое место, где вы оказываете услуги.', 'medium');
    }

    if (stage.id === 'procedures' && !procedureWorkplaceNoticeShown) {
      const procedures = getProcedures();
      if (procedures.length > 0 && !procedures.some((procedure) => Array.isArray(procedure.workplaces) && procedure.workplaces.length > 0)) {
        procedureWorkplaceNoticeShown = true;
        infoModal('Рабочее пространство', 'Чтобы корректно продолжить работу, хотя бы одна процедура должна быть связана с рабочим пространством.', 'medium');
      }
    }
  };

  const observer = new MutationObserver(syncNext);
  observer.observe(content, { childList: true, subtree: true });
  content.addEventListener('input', syncNext);
  content.addEventListener('change', syncNext);
  syncNext();

  nextButton?.addEventListener('click', async () => {
    if (!stage.ready?.(module, content)) return;
    if (stage.beforeNext && !stage.beforeNext(module, content)) return;

    observer.disconnect();
    const wasComplete = localStorage.getItem(COMPLETE_KEY) === '1';
    if (wasComplete && stage.id === 'documents') {
      localStorage.removeItem(STEP_KEY);
      localStorage.removeItem(LEGACY_STEP_KEY);
      onComplete();
      return;
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex < stages.length) {
      writeStep(nextIndex);
      await renderOnboarding(root, { onComplete, accountEmail });
      return;
    }

    localStorage.setItem(COMPLETE_KEY, '1');
    localStorage.setItem(DOCUMENTS_ACK_KEY, '1');
    localStorage.removeItem(STEP_KEY);
    localStorage.removeItem(LEGACY_STEP_KEY);
    onComplete();
  });
}
