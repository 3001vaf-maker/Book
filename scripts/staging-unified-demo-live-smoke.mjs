import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  configureBookDocumentBases,
  reconcileBookDocuments,
} from '../settings/documents/data.js';

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
  if (token) headers['Author' + 'ization'] = ['Bear' + 'er', token].join(' ');
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  const accepted = expected === undefined ? response.ok : response.status === expected;
  if (!accepted) {
    const wanted = expected === undefined ? '2xx' : String(expected);
    throw new Error(`${method} ${path}: expected HTTP ${wanted}, got ${response.status}: ${text}`);
  }
  return payload;
}

async function expectStatus(path, expected, options = {}) {
  return request(path, { ...options, expected });
}

const ownerPassword = compose(['exec', '-T', 'backend', 'printenv', 'OWNER_PASSWORD']).replace(/\r/g, '');
const owner = await request('/auth/login', {
  method: 'POST',
  body: { email: 'staging@book.local', password: ownerPassword },
});
assert.ok(owner.accessToken);
const ownerToken = owner.accessToken;
const ownerTenantId = owner.tenant.id;
const ownerUserId = owner.user.id;

const platform = await request('/platform/legal/readiness', { token: ownerToken });
assert.equal(platform.state?.status, 'LEGAL_READY');
assert.equal(platform.state?.filingStatus, 'SUBMITTED');
for (const key of ['privacy-policy', 'saas-agreement', 'dpa', 'master-pd-consent']) {
  assert.ok((platform.documents || []).some((document) => document.key === key && document.currentVersion));
}

const manualInvite = await request('/saas-admin/manual-invitations', {
  token: ownerToken,
  method: 'POST',
  body: {},
});
assert.ok(manualInvite.tenantId && manualInvite.url);
const tenantId = manualInvite.tenantId;
const registrationUrl = new URL(manualInvite.url);
const registrationToken = registrationUrl.searchParams.get('token');
assert.ok(registrationToken);

const initialMode = sql(`SELECT "operationMode" FROM "TenantLegalState" WHERE "tenantId"=${sqlLiteral(tenantId)};`);
assert.equal(initialMode, 'DEMO');

const inspect = await request('/manual-invitations/inspect', {
  method: 'POST',
  body: { token: registrationToken },
});
for (const key of ['privacy-policy', 'saas-agreement', 'dpa', 'master-pd-consent']) {
  assert.ok((inspect.documents || []).some((document) => document.key === key));
}
const offer = (inspect.documents || []).find((document) => document.key === 'saas-agreement');
assert.ok(offer?.content?.includes('Переход в LIVE совершается пользователем явным действием'));
assert.ok(offer?.content?.includes('не проверяет и не удостоверяет юридическую готовность пользователя'));

const email = 'unified-live-master@book.invalid';
const phone = '+79990000881';
const account = await request('/manual-invitations/accept', {
  method: 'POST',
  body: {
    token: registrationToken,
    email,
    password: 'UnifiedLive123!',
    saasAgreementAccepted: true,
    dpaAccepted: true,
    privacyAcknowledged: true,
    pdConsentAccepted: true,
    marketingConsentAccepted: false,
  },
});
assert.ok(account.accessToken);
assert.equal(account.legal?.operationMode, 'DEMO');
const token = account.accessToken;

const tenantChecklist = sql(`SELECT COALESCE("checklist"::text,'{}') FROM "TenantLegalState" WHERE "tenantId"=${sqlLiteral(tenantId)};`);
assert.equal(tenantChecklist.includes('dpaAccepted'), false, 'legacy tenant checklist must not be recreated');
const legacyTenantDocs = Number(sql(`SELECT COUNT(*) FROM "LegalDocument" WHERE "scope"='TENANT' AND "tenantId"=${sqlLiteral(tenantId)};`) || 0);
assert.equal(legacyTenantDocs, 0, 'new master path must not create legacy TENANT legal documents');

const readiness = await request('/legal/readiness', { token });
assert.equal(readiness.state?.operationMode, 'DEMO');
assert.equal(readiness.state?.filingStatus, 'NOT_PREPARED');
assert.equal(readiness.canBecomeLive, true);

await expectStatus('/legal/filing/submitted', 404, { token, method: 'POST', body: {} });
await expectStatus('/legal/documents', 404, { token, method: 'POST', body: {} });

let me = await request('/auth/me', { token });
assert.equal(me.user?.onboardingStep, 0);
await request('/auth/onboarding-step', { token, method: 'POST', body: { step: 1 } });
me = await request('/auth/me', { token });
assert.equal(me.user?.onboardingStep, 1, 'DEMO guidance progress must live on the server');

const profileBeforeBootstrap = await request('/profile', { token });
assert.equal(profileBeforeBootstrap.migrated, false, 'registration must not create the master profile');
const bootstrappedProfile = await request('/profile/bootstrap', {
  token,
  method: 'POST',
  body: { timeZone: 'Europe/Moscow' },
});
assert.equal(bootstrappedProfile.verified, true);
assert.equal(bootstrappedProfile.profile?.name || '', '');
assert.deepEqual(bootstrappedProfile.profile?.phones || [], []);
assert.deepEqual(bootstrappedProfile.workplaces || [], []);

const emptyDocumentState = await request('/document-state', { token });
if (!emptyDocumentState.migrated) {
  await request('/document-state/bootstrap', {
    token,
    method: 'POST',
    body: { documents: [], consents: [], history: [] },
  });
}
let documentsState = await request('/document-state', { token });
assert.equal(documentsState.verified, true);
assert.deepEqual(documentsState.data?.documents || [], [], 'no master documents before completed profile');

const profile = {
  key: 'profile',
  name: 'Unified',
  surname: 'Master',
  phone,
  phones: [phone],
  telegrams: [],
  emails: [email],
  about: '',
  photo: '',
  profession: 'Парикмахер',
  experience: 'Более 20 лет',
  professionAbout: '',
};
await request('/profile', {
  token,
  method: 'PUT',
  body: { profile, customProfessions: [] },
});
const workplace = {
  key: 'studio',
  profileId: 'profile',
  photo: '',
  name: 'Студия',
  color: '',
  city: 'Москва',
  address: 'Тестовый адрес',
  phone,
  currency: 'RUB',
  from: '09:00',
  to: '18:00',
  links: [],
  about: '',
};
await request('/profile/workplaces/studio', { token, method: 'PUT', body: workplace });

const bases = await request('/document-state/bases', { token });
configureBookDocumentBases(bases, { profile, workplaces: [workplace] });
const reconciled = reconcileBookDocuments(documentsState.data?.documents || [], documentsState.data?.history || []);
assert.equal(reconciled.changed, true);
assert.deepEqual(reconciled.documents.map((document) => document.id).sort(), ['messages-consent', 'pdn-agreement', 'pdn-consent']);
for (const document of reconciled.documents) {
  assert.match(document.text, /Unified Master/);
  assert.doesNotMatch(document.text, /\[ФИО пользователя\]|________________/);
}
assert.equal(reconciled.documents.find((document) => document.id === 'pdn-consent')?.required, true);
assert.equal(reconciled.documents.find((document) => document.id === 'messages-consent')?.required, false);

await request('/document-state/documents', {
  token,
  method: 'PUT',
  body: { value: reconciled.documents },
});
await request('/document-state/history', {
  token,
  method: 'PUT',
  body: { value: reconciled.history },
});
documentsState = await request('/document-state', { token });
assert.equal(documentsState.data?.documents?.length, 3);

for (const key of ['online_booking.access', 'documents.access', 'timetable.access']) {
  const id = `unified-smoke-${key.replaceAll('.', '-')}`;
  sql(`
    INSERT INTO "TenantCapabilityOverride" ("id","tenantId","capabilityId","enabled","limit","createdAt","updatedAt")
    SELECT ${sqlLiteral(id)}, ${sqlLiteral(tenantId)}, c."id", true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "Capability" c WHERE c."key"=${sqlLiteral(key)}
    ON CONFLICT ("tenantId","capabilityId") DO UPDATE SET "enabled"=true,"updatedAt"=CURRENT_TIMESTAMP;
  `);
}

await request('/business-state/bootstrap', { token, method: 'POST', body: {} });
await request('/business-state/operational/bootstrap', { token, method: 'POST', body: {} });
await expectStatus('/business-state/people/real-client', 403, {
  token,
  method: 'PUT',
  body: { person: { key: 'real-client', name: 'Real Client' } },
});
await expectStatus('/online-booking/owner/publication', 403, {
  token,
  method: 'PUT',
  body: { data: { source: 'demo-must-not-publish' } },
});
await expectStatus('/legal/live', 400, { token, method: 'POST', body: {} });

let live = await request('/legal/live', {
  token,
  method: 'POST',
  body: {
    decision: 'CONTINUE_WITHOUT_CONFIRMATION',
    rknStatus: 'NOT_SUBMITTED',
    responsibilityAcknowledged: true,
  },
});
assert.equal(live.state?.operationMode, 'LIVE');
assert.equal(live.state?.filingStatus, 'NOT_PREPARED');
assert.equal(live.liveDecision, 'CONTINUE_WITHOUT_CONFIRMATION');
assert.equal(live.rknStatus, 'NOT_SUBMITTED');

const publication = await request('/online-booking/owner/publication', {
  token,
  method: 'PUT',
  body: { data: { source: 'unified-live-smoke' } },
});
assert.ok(Number(publication.revision) >= 1);

let publicContext = await request(`/online-booking/${tenantId}/context`);
assert.equal(publicContext.tenantId, tenantId);
assert.ok((publicContext.documents || []).some((document) => document.id === 'pdn-consent' && document.required === true));
assert.ok((publicContext.documents || []).some((document) => document.id === 'messages-consent' && document.required === false));

await request('/legal/demo', {
  token,
  method: 'POST',
  body: { reason: 'smoke verify READY path' },
});
await expectStatus(`/online-booking/${tenantId}/context`, 403);
live = await request('/legal/live', {
  token,
  method: 'POST',
  body: {
    decision: 'READY',
    rknStatus: 'UNKNOWN',
    responsibilityAcknowledged: true,
  },
});
assert.equal(live.state?.operationMode, 'LIVE');
assert.equal(live.liveDecision, 'READY');

await request('/legal/demo', {
  token,
  method: 'POST',
  body: { reason: 'smoke verify guided submitted path' },
});
live = await request('/legal/live', {
  token,
  method: 'POST',
  body: {
    decision: 'GUIDED_SUBMITTED',
    rknStatus: 'SUBMITTED',
    submissionReference: 'STAGING-UNIFIED-RKN',
    responsibilityAcknowledged: true,
  },
});
assert.equal(live.state?.operationMode, 'LIVE');
assert.equal(live.state?.filingStatus, 'SUBMITTED');
assert.equal(live.liveDecision, 'GUIDED_SUBMITTED');
assert.equal(live.rknStatus, 'SUBMITTED');

publicContext = await request(`/online-booking/${tenantId}/context`);
assert.equal(publicContext.tenantId, tenantId);

const versionRows = Number(sql('SELECT COUNT(*) FROM "LegalDocumentVersion";') || 0);
assert.ok(versionRows > 0);
const stateEvents = Number(sql(`SELECT COUNT(*) FROM "LegalStateEvent" WHERE "tenantId"=${sqlLiteral(tenantId)};`) || 0);
assert.ok(stateEvents >= 4, 'DEMO/LIVE decisions must leave append-only legal evidence');

const accessTenant = sql(`SELECT "status" FROM "TenantAccess" WHERE "tenantId"=${sqlLiteral(tenantId)};`);
assert.equal(accessTenant, 'ACTIVE');

sql(`UPDATE "TenantAccess" SET "status"='SUSPENDED',"updatedAt"=CURRENT_TIMESTAMP WHERE "tenantId"=${sqlLiteral(tenantId)};`);
await expectStatus('/auxiliary-state', 403, { token });
sql(`UPDATE "TenantAccess" SET "status"='ACTIVE',"updatedAt"=CURRENT_TIMESTAMP WHERE "tenantId"=${sqlLiteral(tenantId)};`);

const prelaunch = await request('/platform/legal/pre-launch', {
  token: ownerToken,
  method: 'POST',
  body: { reason: 'unified smoke platform protection' },
});
assert.equal(prelaunch.state?.status, 'PRE_LAUNCH');
await expectStatus(`/online-booking/${tenantId}/context`, 403);
await expectStatus('/saas-admin/manual-invitations', 403, { token: ownerToken, method: 'POST', body: {} });
const readyAgain = await request('/platform/legal/legal-ready', { token: ownerToken, method: 'POST', body: {} });
assert.equal(readyAgain.state?.status, 'LEGAL_READY');
publicContext = await request(`/online-booking/${tenantId}/context`);
assert.equal(publicContext.tenantId, tenantId);

const ownerAdminCount = Number(sql(`SELECT COUNT(*) FROM "PlatformAdmin" WHERE "userId"=${sqlLiteral(ownerUserId)};`) || 0);
assert.equal(ownerAdminCount, 1);
assert.notEqual(ownerTenantId, tenantId);

console.log('unified DEMO -> LIVE staging smoke: ok');
