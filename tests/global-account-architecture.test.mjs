import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('server/prisma/schema.prisma', 'utf8');
const migration = fs.readFileSync('server/prisma/migrations/20260921130000_global_account_identity/migration.sql', 'utf8');
const accountApi = fs.readFileSync('core/account/index.js', 'utf8');
const guard = fs.readFileSync('server/src/online-booking/account.guard.ts', 'utf8');
const booking = fs.readFileSync('server/src/online-booking/online-booking.service.ts', 'utf8');
const communication = fs.readFileSync('server/src/communication/communication.service.ts', 'utf8');
const runtime = fs.readFileSync('online-booking/account-runtime.js', 'utf8');

const accountModel = schema.slice(schema.indexOf('model Account {'), schema.indexOf('model BookingRequest {'));

assert.doesNotMatch(accountModel, /\btenantId\s+String\b/, 'End-human Account must not be owned by one Tenant');
assert.match(accountModel, /createdViaTenantId\s+String\?/, 'Account may retain only provenance of the Tenant where it was first created');
assert.match(schema, /model AccountContact \{/);
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

console.log('global account architecture tests passed');
