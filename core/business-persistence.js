import { apiRequest } from './auth.js';

let serverReady = false;
let running = false;
let lastError = null;
const queue = [];
const idleWaiters = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function reportError(error) {
  lastError = error instanceof Error ? error : new Error(String(error || 'Ошибка серверного сохранения'));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('book:business-persistence-error', { detail: { message: lastError.message } }));
  }
}

function resolveIdle() {
  if (queue.length || running) return;
  while (idleWaiters.length) idleWaiters.shift()?.();
}

async function send(item) {
  const response = await apiRequest(item.path, {
    ...item.options,
    keepalive: true,
  });
  return responseJson(response, item.fallbackMessage);
}

async function runQueue() {
  if (running || !serverReady) return;
  running = true;
  try {
    while (serverReady && queue.length) {
      const item = queue[0];
      try {
        await send(item);
        queue.shift();
        lastError = null;
        item.resolve?.();
      } catch (error) {
        reportError(error);
        await sleep(1200);
      }
    }
  } finally {
    running = false;
    resolveIdle();
    if (serverReady && queue.length) void runQueue();
  }
}

function enqueue(path, options, fallbackMessage) {
  if (!serverReady) return Promise.resolve();
  let resolve;
  const done = new Promise((doneResolve) => { resolve = doneResolve; });
  queue.push({ path, options, fallbackMessage, resolve });
  void runQueue();
  return done;
}

export function setBusinessServerReady(value) {
  serverReady = Boolean(value);
  if (serverReady) void runQueue();
}

export function isBusinessServerReady() {
  return serverReady;
}

export function getBusinessPersistenceError() {
  return lastError;
}

export function queuePersonUpsert(person, position = 0) {
  const key = String(person?.key || '').trim();
  if (!key) return Promise.resolve();
  return enqueue(`/business-state/people/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ person, position }),
  }, 'Не удалось сохранить клиента на сервере');
}

export function queuePersonDelete(key) {
  const id = String(key || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/people/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Не удалось удалить клиента на сервере');
}

export function queueUEIStore(uei) {
  return enqueue('/business-state/uei', {
    method: 'PUT',
    body: JSON.stringify({ uei }),
  }, 'Не удалось сохранить UEI на сервере');
}

export function queueRecordUpsert(record, position = 0) {
  const id = String(record?.id || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/records/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ record, position }),
  }, 'Не удалось сохранить запись на сервере');
}

export function queueRecordDelete(id) {
  const recordId = String(id || '').trim();
  if (!recordId) return Promise.resolve();
  return enqueue(`/business-state/records/${encodeURIComponent(recordId)}`, { method: 'DELETE' }, 'Не удалось удалить запись на сервере');
}

export function queueRecordEventUpsert(event, position = 0) {
  const id = String(event?.id || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/record-events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ event, position }),
  }, 'Не удалось сохранить историю записи на сервере');
}

export function queueRecordEventsDelete(recordId) {
  const id = String(recordId || '').trim();
  if (!id) return Promise.resolve();
  return enqueue(`/business-state/records/${encodeURIComponent(id)}/events`, { method: 'DELETE' }, 'Не удалось удалить историю записи на сервере');
}

export async function flushBusinessPersistence({ timeoutMs = 12000 } = {}) {
  if (!serverReady || (!queue.length && !running)) return;
  let timer;
  await Promise.race([
    new Promise((resolve) => {
      idleWaiters.push(resolve);
      resolveIdle();
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(lastError || new Error('Серверное сохранение не завершено')), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}
