import assert from 'node:assert/strict';
import { createUEI, detachUEI, hydrateUEIFromServer, linkUEI } from '../core/uei.js';
import { getClients, hydrateClientsFromServer } from '../main/clients/data.js';
import { hydrateConsentsFromServer } from '../settings/documents/consents.js';

hydrateClientsFromServer([
  { key: 'manual', name: 'Анна', phones: ['+79030000001'], accounts: [] },
  { key: 'registered', name: 'Анна', phones: ['+79030000002'], emails: ['anna@example.test'], telegrams: ['777001'], accounts: ['account-1'] },
]);
hydrateUEIFromServer({ entities: {}, relations: {}, revoked: [] });
hydrateConsentsFromServer([
  {
    id: 'pdn-account',
    subjectType: 'BOOKING_ACCOUNT',
    subjectKey: 'account-1',
    documentId: 'pdn-consent',
    documentVersion: 1,
    status: 'accepted',
    eventAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'messages-telegram',
    subjectType: 'CONTACT_POINT',
    subjectKey: 'TELEGRAM:777001',
    contactType: 'TELEGRAM',
    contactValue: '777001',
    documentId: 'messages-consent',
    documentVersion: 1,
    status: 'accepted',
    eventAt: '2026-09-01T10:00:00.000Z',
  },
]);

let clients = getClients();
assert.equal(clients.length, 2);
assert.equal(clients.find((item) => item.key === 'registered')?.agreements.personalData, true);
assert.equal(clients.find((item) => item.key === 'registered')?.agreements.mailings, true);

createUEI({ entityType: 'person', entityId: 'manual', value: 'A1', identifiers: ['+79030000001'] });
linkUEI({ entityType: 'person', entityId: 'registered', value: '00A1', identifiers: ['+79030000002'] });

clients = getClients();
assert.equal(clients.length, 1);
assert.equal(clients[0].key, 'manual');
assert.equal(clients[0].agreements.personalData, true);
assert.equal(clients[0].agreements.mailings, true);

detachUEI({ entityType: 'person', entityId: 'registered', uei: '00A1', explicit: true });
clients = getClients();
assert.equal(clients.length, 2);
assert.equal(clients.find((item) => item.key === 'registered')?.agreements.personalData, true);
assert.equal(clients.find((item) => item.key === 'registered')?.agreements.mailings, true);
assert.equal(clients.find((item) => item.key === 'manual')?.agreements.personalData, false);
assert.equal(clients.find((item) => item.key === 'manual')?.agreements.mailings, false);

console.log('consent identity integration tests: OK');
