import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base = 'http://localhost:8080/api';

function compose(args, options = {}) {
  return execFileSync('docker', ['compose', '-f', 'docker-compose.staging.yml', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function sql(query) {
  return compose(['exec', '-T', 'db', 'psql', '-U', 'book', '-d', 'book_staging', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query]);
}

async function request(path, { token = '', method = 'GET', body, expected } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  const ok = expected === undefined ? response.ok : response.status === expected;
  if (!ok) throw new Error(`${method} ${path}: expected ${expected ?? '2xx'}, got ${response.status}: ${text}`);
  return payload;
}

const ownerPassword = compose(['exec', '-T', 'backend', 'printenv', 'OWNER_PASSWORD']).replace(/\r/g, '');
const owner = await request('/auth/login', {
  method: 'POST',
  body: { email: 'staging@book.local', password: ownerPassword },
});
assert.ok(owner.accessToken);
const token = owner.accessToken;
const tenantId = owner.tenant.id;
const userId = owner.user.id;

// Mirror the production clean reset of 16.09 for the preserved owner workspace only.
sql(`
  DELETE FROM "BusinessRecordEvent" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessRecord" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessPerson" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessIdentityState" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessOperationalState" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessDocumentState" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessAuxiliaryState" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "BusinessStateMeta" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "Workplace" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "Profile" WHERE "tenantId"=${sqlLiteral(tenantId)};
  DELETE FROM "WorkspaceState" WHERE "tenantId"=${sqlLiteral(tenantId)};
`);

assert.equal(Number(sql(`SELECT COUNT(*) FROM "Profile" WHERE "tenantId"=${sqlLiteral(tenantId)};`) || 0), 0);
assert.equal(Number(sql(`SELECT COUNT(*) FROM "BusinessStateMeta" WHERE "tenantId"=${sqlLiteral(tenantId)};`) || 0), 0);
assert.equal(Number(sql(`SELECT COUNT(*) FROM "BusinessOperationalState" WHERE "tenantId"=${sqlLiteral(tenantId)};`) || 0), 0);
assert.equal(Number(sql(`SELECT COUNT(*) FROM "BusinessDocumentState" WHERE "tenantId"=${sqlLiteral(tenantId)};`) || 0), 0);
assert.equal(Number(sql(`SELECT COUNT(*) FROM "BusinessAuxiliaryState" WHERE "tenantId"=${sqlLiteral(tenantId)};`) || 0), 0);

// Account/control plane must survive exactly like production reset.
const me = await request('/auth/me', { token });
assert.equal(me.user.id, userId);
assert.equal(me.tenant.id, tenantId);

const access = await request('/saas-access/me', { token });
assert.equal(access.status, 'ACTIVE');
assert.equal(access.isOwnerBook, true);

// Current Book startup: owner skips tenant DEMO/LIVE and rebuilds empty server-owned workspace state.
const emptyProfile = await request('/profile', { token });
assert.equal(emptyProfile.migrated, false);
assert.equal(emptyProfile.verified, false);

const bootstrappedProfile = await request('/profile/bootstrap', {
  token,
  method: 'POST',
  body: { timeZone: 'Europe/Moscow' },
});
assert.equal(bootstrappedProfile.verified, true);
assert.equal(bootstrappedProfile.profile?.emails?.[0], 'staging@book.local');

const savedProfile = await request('/profile', {
  token,
  method: 'PUT',
  body: {
    profile: {
      key: 'profile',
      name: 'Owner',
      surname: 'Book',
      phone: '+79990000999',
      phones: ['+79990000999'],
      emails: ['staging@book.local'],
      telegrams: [],
      profession: 'Парикмахер',
      experience: '30',
      about: '',
      photo: '',
      professionAbout: '',
    },
    customProfessions: [],
  },
});
assert.equal(savedProfile.verified, true);
assert.equal(savedProfile.profile?.name, 'Owner');
assert.equal(savedProfile.profile?.profession, 'Парикмахер');

const workplace = await request('/profile/workplaces/owner-smoke', {
  token,
  method: 'PUT',
  body: {
    name: 'Рабочее место',
    city: 'Москва',
    address: 'Тест',
    phone: '+79990000999',
    currency: 'RUB',
    from: '09:00',
    to: '18:00',
    links: [],
    about: '',
  },
});
assert.equal(workplace.verified, true);
assert.ok((workplace.workplaces || []).some((item) => item.key === 'owner-smoke'));

const rereadProfile = await request('/profile', { token });
assert.equal(rereadProfile.verified, true);
assert.equal(rereadProfile.profile?.name, 'Owner');
assert.equal(rereadProfile.profile?.profession, 'Парикмахер');
assert.ok((rereadProfile.workplaces || []).some((item) => item.key === 'owner-smoke'));

const businessBefore = await request('/business-state', { token });
assert.equal(businessBefore.verified, false);
const business = await request('/business-state/bootstrap', { token, method: 'POST', body: {} });
assert.equal(business.verified, true);
assert.deepEqual(business.people || [], []);
assert.deepEqual(business.records || [], []);

const operationalBefore = await request('/business-state/operational', { token });
assert.equal(operationalBefore.verified, false);
const operational = await request('/business-state/operational/bootstrap', { token, method: 'POST', body: {} });
assert.equal(operational.verified, true);

const documentBefore = await request('/document-state', { token });
assert.equal(documentBefore.verified, false);
const documentBases = await request('/document-state/bases', { token });
assert.ok(Array.isArray(documentBases));
const documents = await request('/document-state/bootstrap', {
  token,
  method: 'POST',
  body: { documents: [], consents: [], history: [] },
});
assert.equal(documents.verified, true);

const auxiliaryBefore = await request('/auxiliary-state', { token });
assert.equal(auxiliaryBefore.verified, false);
const auxiliary = await request('/auxiliary-state/bootstrap', { token, method: 'POST', body: {} });
assert.equal(auxiliary.verified, true);

// Final state mirrors what renderAuthenticated() requires before renderWorkspace().
assert.equal((await request('/profile', { token })).verified, true);
assert.equal((await request('/business-state', { token })).verified, true);
assert.equal((await request('/business-state/operational', { token })).verified, true);
assert.equal((await request('/document-state', { token })).verified, true);
assert.equal((await request('/auxiliary-state', { token })).verified, true);

console.log('owner clean-reset full startup smoke: ok');
