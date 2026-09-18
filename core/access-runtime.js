import {
  acknowledgeCapabilityIntroduction,
  acknowledgeCapabilitySummary,
  canUseCapability,
  getPendingCapabilityChanges,
  refreshAccess,
} from './access.js';
import { getAuthToken } from './auth.js';
import {
  getCapabilityByEntryTarget,
  getCapabilityIntro,
  getCapabilityTitle,
} from './capability-registry.js';
import { openBlockingNotice } from '../ui/modals/index.js';

let refreshInFlight = null;
let pendingState = { summaries: [], introductions: [] };
let summaryModal = null;
let introModal = null;
let queuedEntry = null;
let replayingEntry = false;

function normalizedPending(value) {
  return {
    summaries: Array.isArray(value?.summaries) ? value.summaries : [],
    introductions: Array.isArray(value?.introductions) ? value.introductions : [],
  };
}

function summaryMessage(summaries) {
  const changes = summaries.flatMap((item) => Array.isArray(item?.changes) ? item.changes : []);
  const enabled = [...new Set(changes.filter((item) => item?.changeType === 'ENABLED').map((item) => item.key))];
  const disabled = [...new Set(changes.filter((item) => item?.changeType === 'DISABLED').map((item) => item.key))];
  const parts = [];
  if (enabled.length) parts.push(`Открыты новые возможности: ${enabled.map(getCapabilityTitle).join(', ')}.`);
  if (disabled.length) parts.push(`Больше недоступны: ${disabled.map(getCapabilityTitle).join(', ')}.`);
  if (enabled.length) parts.push('При первом открытии каждого нового раздела система отдельно покажет, для чего он нужен и что делать дальше.');
  return parts.join(' ');
}

async function reloadPendingState() {
  pendingState = normalizedPending(await getPendingCapabilityChanges());
  return pendingState;
}

async function refreshRuntimeState() {
  if (!getAuthToken()) return pendingState;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    await reloadPendingState();
    if (pendingState.summaries.length) await refreshAccess();
    showPendingSummary();
    return pendingState;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function acknowledgeAllSummaries(summaries) {
  const batchIds = [...new Set(summaries.map((item) => String(item?.batchId || '').trim()).filter(Boolean))];
  for (const batchId of batchIds) {
    await acknowledgeCapabilitySummary(batchId);
  }
  await reloadPendingState();
}

function replayQueuedEntry() {
  const queued = queuedEntry;
  queuedEntry = null;
  if (!queued?.element?.isConnected) return;
  if (!canUseCapability(queued.meta.key)) return;
  const introduction = pendingState.introductions.find((item) => item.key === queued.meta.key);
  if (introduction) {
    showCapabilityIntroduction(queued.meta, introduction, queued.element);
    return;
  }
  replayingEntry = true;
  try {
    queued.element.click();
  } finally {
    replayingEntry = false;
  }
}

function showPendingSummary() {
  if (summaryModal?.isConnected || introModal?.isConnected) return;
  const summaries = pendingState.summaries;
  if (!summaries.length) return;
  const changes = summaries.flatMap((item) => Array.isArray(item?.changes) ? item.changes : []);
  const hasEnabled = changes.some((item) => item?.changeType === 'ENABLED');
  const hasDisabled = changes.some((item) => item?.changeType === 'DISABLED');
  const title = hasEnabled && !hasDisabled
    ? 'Появились новые возможности'
    : hasDisabled && !hasEnabled
      ? 'Доступ изменился'
      : 'Возможности изменились';

  summaryModal = openBlockingNotice({
    title,
    message: summaryMessage(summaries),
    action: 'Понятно',
    onConfirm: async () => {
      await acknowledgeAllSummaries(summaries);
      summaryModal = null;
      window.setTimeout(replayQueuedEntry, 0);
    },
  });
}

function showCapabilityIntroduction(meta, introduction, element) {
  if (introModal?.isConnected || summaryModal?.isConnected) return;
  const copy = getCapabilityIntro(meta.key);
  introModal = openBlockingNotice({
    title: copy?.title || meta.title,
    message: copy?.body || meta.description || meta.title,
    action: copy?.action || 'Продолжить',
    onConfirm: async () => {
      pendingState = normalizedPending(await acknowledgeCapabilityIntroduction(introduction.eventId));
      await refreshAccess();
      introModal = null;
      if (pendingState.summaries.length) {
        queuedEntry = null;
        window.setTimeout(showPendingSummary, 0);
        return;
      }
      if (!element?.isConnected || !canUseCapability(meta.key)) return;
      replayingEntry = true;
      try {
        element.click();
      } finally {
        replayingEntry = false;
      }
    },
  });
}

async function handleCapabilityEntry(meta, element) {
  queuedEntry = { meta, element };
  try {
    await refreshRuntimeState();
  } catch {
    queuedEntry = null;
    replayingEntry = true;
    try {
      element.click();
    } finally {
      replayingEntry = false;
    }
    return;
  }

  if (pendingState.summaries.length) {
    showPendingSummary();
    return;
  }
  replayQueuedEntry();
}

function onEntryClick(event) {
  if (replayingEntry || summaryModal?.isConnected || introModal?.isConnected) return;
  const target = event.target;
  const meta = getCapabilityByEntryTarget(target);
  if (!meta?.entrySelector || !(target instanceof Element)) return;
  const element = target.closest(meta.entrySelector);
  if (!element) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void handleCapabilityEntry(meta, element);
}

function activityRefresh() {
  if (!getAuthToken() || summaryModal?.isConnected || introModal?.isConnected) return;
  void refreshRuntimeState().catch(() => {});
}

document.addEventListener('click', onEntryClick, true);
document.addEventListener('pointerdown', activityRefresh, { capture: true, passive: true });
document.addEventListener('keydown', activityRefresh, { capture: true, passive: true });
document.addEventListener('submit', activityRefresh, { capture: true, passive: true });
window.addEventListener('focus', activityRefresh, { passive: true });
window.addEventListener('hashchange', activityRefresh, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') activityRefresh();
});

window.addEventListener('workspace:access-updated', () => {
  if (!getAuthToken() || refreshInFlight || summaryModal?.isConnected || introModal?.isConnected) return;
  void reloadPendingState().then(showPendingSummary).catch(() => {});
});
