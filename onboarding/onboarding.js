import { getProfile } from '../settings/profile/data.js';
import { getWorkplaces } from '../settings/profile/workplaces/data.js';
import { getProcedures } from '../settings/service/procedures/data.js';
import { getDays } from '../core/day.js';
import { getClientCount } from '../main/clients/data.js';
import { actionBlock, button, openNotice } from '../ui/ui.js';

const COMPLETE_KEY = 'book.onboarding.complete.v1';
const STEP_KEY = 'book.onboarding.step.v1';

const stages = [
  {
    id: 'profile',
    load: () => import('../settings/profile/profile.js'),
    render: (module, root) => module.render(root, () => {}),
    validate() {
      const profile = getProfile();
      const hasProfile = Boolean(
        String(profile.name || '').trim()
        && (profile.phones || []).some((value) => String(value || '').trim())
        && String(profile.profession || '').trim(),
      );
      if (!hasProfile) return 'Заполните обязательные данные профиля.';
      if (!getWorkplaces().length) return 'Добавьте рабочее место.';
      return '';
    },
  },
  {
    id: 'procedures',
    load: () => import('../settings/service/procedures/procedures.js'),
    render: (module, root) => module.render(root, () => {}),
    validate: () => getProcedures().length ? '' : 'Добавьте хотя бы одну процедуру.',
  },
  {
    id: 'wallets',
    load: () => import('../settings/wallets/wallets.js'),
    render: (module, root) => module.render(root, () => {}),
    validate: () => '',
  },
  {
    id: 'timetable',
    load: () => import('../timetable/timetable.js'),
    render: (module, root) => module.renderTimetable(root),
    validate: () => getDays().length ? '' : 'Добавьте хотя бы один рабочий день.',
  },
  {
    id: 'clients',
    load: () => import('../main/clients/clients.js'),
    render: (module, root) => module.renderClients(root),
    validate: () => getClientCount() > 0 ? '' : 'Добавьте первого клиента.',
  },
];

function readStep() {
  const value = Number(localStorage.getItem(STEP_KEY));
  return Number.isInteger(value) && value >= 0 && value < stages.length ? value : 0;
}

function writeStep(index) {
  localStorage.setItem(STEP_KEY, String(index));
}

export function isOnboardingComplete() {
  return localStorage.getItem(COMPLETE_KEY) === '1';
}

export async function renderOnboarding(root, { onComplete = () => {} } = {}) {
  const stepIndex = readStep();
  const stage = stages[stepIndex];
  if (!stage) return;

  root.innerHTML = `<main class="app-content onboarding-view"><section class="onboarding-content" data-onboarding-content></section><div class="onboarding-actions" data-onboarding-actions>${actionBlock(button(stepIndex === stages.length - 1 ? 'Начать работу' : 'Продолжить', { data: 'data-onboarding-next' }))}</div></main>`;
  const content = root.querySelector('[data-onboarding-content]');
  const module = await stage.load();
  stage.render(module, content);

  root.querySelector('[data-onboarding-next]')?.addEventListener('click', async () => {
    const error = stage.validate();
    if (error) {
      openNotice(root, { title: 'Завершите этот шаг', message: error });
      return;
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex < stages.length) {
      writeStep(nextIndex);
      await renderOnboarding(root, { onComplete });
      return;
    }

    localStorage.setItem(COMPLETE_KEY, '1');
    localStorage.removeItem(STEP_KEY);
    onComplete();
  });
}
