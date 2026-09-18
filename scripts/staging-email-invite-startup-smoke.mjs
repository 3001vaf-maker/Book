import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  if (!ok) {
    throw new Error(`${method} ${path}: expected ${expected ?? '2xx'}, got ${response.status}: ${text}`);
  }
  return payload;
}

const ownerPassword = compose(['exec', '-T', 'backend', 'printenv', 'OWNER_PASSWORD']).replace(/\r/g, '');
const owner = await request('/auth/login', {
  method: 'POST',
  body: { email: 'staging@book.local', password: ownerPassword },
});
assert.ok(owner.accessToken);
const ownerToken = owner.accessToken;

const email = 'email-path-user@book.invalid';
const inviteName = 'Email Path';
await request('/saas-admin/invitations', {
  token: ownerToken,
  method: 'POST',
  body: { email, name: inviteName },
});

const row = sql(`
  SELECT "id" || '|' || "tenantId"
  FROM "MasterInvitation"
  WHERE "email"=${sqlLiteral(email)}
  ORDER BY "createdAt" DESC
  LIMIT 1;
`);
assert.ok(row && row.includes('|'), 'email invitation must be created');
const [invitationId, tenantId] = row.split('|');
assert.ok(invitationId && tenantId);

const knownToken = 'email-path-known-token-2026';
const knownHash = createHash('sha256').update(knownToken).digest('hex');
sql(`
  UPDATE "MasterInvitation"
  SET "tokenHash"=${sqlLiteral(knownHash)}, "expiresAt"=CURRENT_TIMESTAMP + INTERVAL '1 day'
  WHERE "id"=${sqlLiteral(invitationId)};
`);

const inspect = await request('/master-invitations/inspect', {
  method: 'POST',
  body: { token: knownToken },
});
assert.equal(inspect.email, email);
for (const key of ['privacy-policy', 'saas-agreement', 'dpa', 'master-pd-consent']) {
  assert.ok((inspect.documents || []).some((document) => document.key === key), `invite must expose ${key}`);
}

const account = await request('/master-invitations/accept', {
  method: 'POST',
  body: {
    token: knownToken,
    name: 'Email',
    surname: 'User',
    phone: '+79990000882',
    email,
    password: ['Email','Path','123!'].join(''),
    saasAgreementAccepted: true,
    dpaAccepted: true,
    privacyAcknowledged: true,
    pdConsentAccepted: true,
    marketingConsentAccepted: false,
  },
});
assert.ok(account.accessToken);
assert.equal(account.tenant?.id, tenantId);
assert.equal(account.legal?.operationMode, 'DEMO');
const token = account.accessToken;

// Mirror the actual authenticated startup sequence of current Book.
const me = await request('/auth/me', { token });
assert.equal(me.tenant?.id, tenantId);
assert.equal(me.user?.email, email);

const access = await request('/saas-access/me', { token });
assert.equal(access.status, 'ACTIVE');
assert.equal(access.isOwnerBook, false);

const legal = await request('/legal/readiness', { token });
assert.equal(legal.state?.operationMode, 'DEMO');

const profile = await request('/profile', { token });
assert.equal(profile.migrated, true);
assert.equal(profile.verified, true);
assert.equal(profile.profile?.name, 'Email');
assert.equal(profile.profile?.surname, 'User');
assert.equal(profile.profile?.profession || '', '');

const businessBefore = await request('/business-state', { token });
if (!businessBefore.verified) {
  const business = await request('/business-state/bootstrap', { token, method: 'POST', body: {} });
  assert.equal(business.verified, true);
}
assert.equal((await request('/business-state', { token })).verified, true);

const operationalBefore = await request('/business-state/operational', { token });
if (!operationalBefore.verified) {
  const operational = await request('/business-state/operational/bootstrap', { token, method: 'POST', body: {} });
  assert.equal(operational.verified, true);
}
assert.equal((await request('/business-state/operational', { token })).verified, true);

const documentBefore = await request('/document-state', { token });
const bases = await request('/document-state/bases', { token });
assert.ok(Array.isArray(bases));
if (!documentBefore.verified) {
  const documents = await request('/document-state/bootstrap', {
    token,
    method: 'POST',
    body: { documents: [], consents: [], history: [] },
  });
  assert.equal(documents.verified, true);
}
assert.equal((await request('/document-state', { token })).verified, true);

const auxiliaryBefore = await request('/auxiliary-state', { token });
if (!auxiliaryBefore.verified) {
  const auxiliary = await request('/auxiliary-state/bootstrap', { token, method: 'POST', body: {} });
  assert.equal(auxiliary.verified, true);
}
assert.equal((await request('/auxiliary-state', { token })).verified, true);

const adminMasters = await request('/saas-admin/masters', { token: ownerToken });
const adminUser = (adminMasters || []).find((item) => item.tenantId === tenantId);
assert.ok(adminUser?.master);
assert.equal(adminUser.startupReady, true);
assert.equal(adminUser.startupState?.access, 'ACTIVE');
assert.equal(adminUser.startupState?.legal, 'DEMO');
assert.equal(adminUser.startupState?.profile, 'READY');
assert.equal(adminUser.startupState?.business, 'READY');
assert.equal(adminUser.startupState?.operational, 'READY');
assert.equal(adminUser.startupState?.documents, 'READY');
assert.equal(adminUser.startupState?.auxiliary, 'READY');

console.log('email invitation full startup smoke: ok');
