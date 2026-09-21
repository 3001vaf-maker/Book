import { apiRequest, getAuthToken } from '../core/auth.js';
import { API_BASE } from '../core/environment.js';

async function jsonResponse(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

export async function getFirstRunState() {
  return jsonResponse(await apiRequest('/first-run/state'), 'Не удалось получить состояние знакомства');
}

export async function markFirstRunStepSeen(stepKey, sessionId = '') {
  return jsonResponse(await apiRequest(`/first-run/steps/${encodeURIComponent(stepKey)}/seen`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  }), 'Не удалось сохранить просмотр этапа');
}

export async function completeFirstRunStep(stepKey, action = 'complete', sessionId = '') {
  return jsonResponse(await apiRequest(`/first-run/steps/${encodeURIComponent(stepKey)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ action, sessionId }),
  }), 'Не удалось завершить этап');
}

export async function startFirstRunSession() {
  return jsonResponse(await apiRequest('/first-run/session/start', {
    method: 'POST',
    body: JSON.stringify({}),
  }), 'Не удалось начать сеанс');
}

export async function heartbeatFirstRunSession(sessionId) {
  if (!sessionId) return null;
  return jsonResponse(await apiRequest(`/first-run/session/${encodeURIComponent(sessionId)}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({}),
  }), 'Не удалось обновить сеанс');
}

export async function endFirstRunSession(sessionId, reason = 'LOGOUT') {
  if (!sessionId) return null;
  return jsonResponse(await apiRequest(`/first-run/session/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }), 'Не удалось завершить сеанс');
}

export function endFirstRunSessionKeepalive(sessionId, reason = 'PAGE_HIDDEN') {
  const token = getAuthToken();
  if (!sessionId || !token) return;
  fetch(`${API_BASE}/first-run/session/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  }).catch(() => undefined);
}

export async function recordFirstRunActivity(eventType, {
  stepKey = '',
  scenarioVersionId = '',
  metadata = {},
  sessionId = '',
} = {}) {
  return jsonResponse(await apiRequest('/first-run/activity', {
    method: 'POST',
    body: JSON.stringify({ eventType, stepKey, scenarioVersionId, metadata, sessionId }),
  }), 'Не удалось сохранить событие');
}

export async function downloadRknGuide() {
  const response = await apiRequest('/first-run/rkn-guide.pdf');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'Не удалось сформировать PDF');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rkn-guide.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
