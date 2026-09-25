import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('server/prisma/schema.prisma', 'utf8');
const migration = fs.readFileSync('server/prisma/migrations/20260921130000_global_account_identity/migration.sql', 'utf8');
const relationshipMigration = fs.readFileSync('server/prisma/migrations/20260925170000_global_account_tenant_link/migration.sql', 'utf8');
const accountApi = fs.readFileSync('core/account/index.js', 'utf8');
const guard = fs.readFileSync('server/src/online-booking/account.guard.ts', 'utf8');
const booking = fs.readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');
const communication = fs.readFileSync('server/src/communication/communication.service.ts', 'utf8');
const runtime = fs.readFileSync('online-booking/account-runtime.js', 'utf8');
const bookingUi = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const consentController = fs.readFileSync('server/src/online-booking/booking-consent.controller.ts', 'utf8');
const controller = fs.readFileSync('server/src/online-booking/online-booking.controller.ts', 'utf8');
const core = fs.readFileSync('core.js', 'utf8');
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
const reset = fs.readFileSync('server/scripts/reset-test-account-before-global-migration.mjs', 'utf8');

const accountStart = schema.indexOf('model Account {');
const accountEnd = schema.indexOf('model AccountTenantLink {', accountStart);
const accountModel = schema.slice(accountStart, accountEnd);

assert.doesNotMatch(accountModel, /\btenantId\s+String\b/, 'End-human Account must not be owned by one Tenant');
assert.match(accountModel, /createdViaTenantId\s+String\?/, 'Account may retain only provenance of the Tenant where it was first created');
assert.match(schema, /model AccountContact \{/);
assert.match(schema, /model AccountTenantLink \{/, 'Global Account must have an explicit relationship to every connected tenant');
assert.match(schema, /@@unique\(\[accountId, tenantId\]\)/, 'One Account/Tenant relationship must not duplicate');
assert.match(relationshipMigration, /INSERT INTO "AccountTenantLink"[\s\S]*"createdViaTenantId"/, 'Existing first-tenant provenance must backfill relationship links');
assert.match(relationshipMigration, /INSERT INTO "AccountTenantLink"[\s\S]*FROM "BookingRequest"/, 'Existing booking history must backfill relationship links');
assert.match(schema, /@@unique\(\[type, value\]\)/, 'Every concrete contact must be globally unique');
assert.match(schema, /enum AccountContactType \{[\s\S]*EMAIL[\s\S]*PHONE[\s\S]*TELEGRAM[\s\S]*\}/);

assert.match(migration, /Global Account migration found one contact assigned to multiple Accounts/);
assert.match(migration, /CREATE UNIQUE INDEX "AccountContact_type_value_key"/);
assert.match(migration, /'TELEGRAM'::"AccountContactType"/);

assert.match(accountApi, /const ACCOUNT_TOKEN_KEY = 'book\.account\.token'/);
assert.doesNotMatch(accountApi, /function tokenKey\(tenantId\)/);
assert.match(accountApi, /resolveAccountTelegramEntry/);

assert.doesNotMatch(guard, /payload\.tenantId/, 'Account token must be global and Tenant context must come from the requested route');
assert.match(guard, /request\.params\?\.tenantId/);
assert.doesNotMatch(guard, /missing tenant context/, 'Global client account routes must authenticate without a tenant context');

assert.match(booking, /accountContact\.findUnique/);
assert.match(booking, /AccountContactType\.EMAIL/);
assert.match(booking, /AccountContactType\.PHONE/);
assert.match(booking, /AccountContactType\.TELEGRAM/);
assert.match(booking, /function accountLoginContact/);
assert.match(booking, /AccountContactType\.EMAIL/);
assert.match(booking, /AccountContactType\.PHONE/);
assert.match(booking, /async loginAccount\(tenantId: string, identifierValue: unknown/);
assert.doesNotMatch(booking, /tenantId_email/, 'Account lookup must never return to tenant-scoped email uniqueness');
assert.doesNotMatch(booking, /signAsync\(\{[\s\S]{0,120}tenantId:/, 'Global Account token must not encode one Tenant as identity owner');

assert.match(communication, /resolveTelegramEntryAccount/);
assert.match(communication, /AccountContactType\.TELEGRAM/);
assert.match(communication, /Этот Telegram уже зарегистрирован в другом аккаунте/);

assert.match(runtime, /resolveAccountTelegramEntry/);
assert.match(runtime, /if \(entry && !getAccountToken\(tenant\)\)/);

assert.match(controller, /@Get\('account\/me'\)/, 'Global client app must expose a tenant-free Account route');
assert.match(controller, /@Get\('account\/relationships'\)/, 'Global client app must expose Account relationships');
assert.match(controller, /@Get\('account\/records'\)/, 'Global client app must expose cross-tenant history');
assert.match(consentController, /accountTenantLink\.upsert/, 'A tenant relationship must be persisted only after tenant consent becomes active');
assert.match(consentController, /consentState\?\.pdnActive/, 'Tenant relationship must be gated by active tenant PDN');
assert.match(bookingUi, /export async function renderGlobalClient\(/, 'Client host must have a global Account entry flow');
assert.match(bookingUi, /state\.platformOnlyLegal = state\.identityDestination === 'profile'/, 'Profile entry must keep platform terms separate from tenant legal documents');
assert.match(bookingUi, /onExitToAccount/, 'Booking context must be escapable back to the global client profile');
assert.match(accountShell, /export async function renderGlobalAccount\(/, 'Global Account must reuse the shared client shell');
assert.match(core, /isEndUserAppHost\(\)/);
assert.match(core, /renderGlobalClientRoot\(\)/);
assert.match(core, /params\.get\('entry'\)/, 'Global profile must distinguish account entry from an external booking link');

console.log('global account architecture tests passed');
