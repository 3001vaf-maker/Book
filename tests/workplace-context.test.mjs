import assert from 'node:assert/strict';
import { getWorkplaceContext, setWorkplaceContext } from '../core/workplace-context.js';

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
};

const workplaces = [
  { key: 'home', name: 'Дом' },
  { key: 'salon', name: 'Салон' },
];

setWorkplaceContext({ workplaceId: 'salon', date: new Date('2026-09-08T00:00:00') });
setWorkplaceContext({ workplaceId: 'home', date: new Date('2026-09-09T00:00:00'), scope: 'journal' });

const graphContext = getWorkplaceContext(workplaces);
const journalContext = getWorkplaceContext(workplaces, { scope: 'journal' });

assert.equal(graphContext.workplaceId, 'salon');
assert.equal(journalContext.workplaceId, 'home');
assert.equal(graphContext.date.getDate(), 8);
assert.equal(journalContext.date.getDate(), 9);
assert.equal(storage.get('book:workplace-context') !== storage.get('book:workplace-context:journal'), true);

console.log('workplace context tests: OK');
