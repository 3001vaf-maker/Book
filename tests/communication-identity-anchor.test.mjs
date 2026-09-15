import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../server/src/communication/communication.service.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../server/prisma/migrations/20260915150000_communication_account_anchor/migration.sql', import.meta.url), 'utf8');

assert.match(migration, /ADD COLUMN "bookingAccountId" TEXT/);
assert.match(migration, /FOREIGN KEY \("bookingAccountId"\) REFERENCES "BookingAccount"\("id"\)/);
assert.match(migration, /matches\.match_count = 1/);

assert.match(service, /"bookingAccountId", "cardPhone", "uei", "externalUserId"/);
assert.match(service, /existingTelegram\.bookingAccountId && existingTelegram\.bookingAccountId !== accountId/);
assert.match(service, /SET "bookingAccountId" = EXCLUDED\."bookingAccountId",\s*"cardPhone" = EXCLUDED\."cardPhone",\s*"uei" = EXCLUDED\."uei"/);
assert.match(service, /const byAccount = rows\.find\(\(row\) => row\.bookingAccountId && anchors\.accountIds\.has\(row\.bookingAccountId\)\)/);
assert.match(service, /const byPhone = rows\.find\(\(row\) => anchors\.phones\.has\(canonicalPhone\(row\.cardPhone\)\)\)/);
assert.match(service, /const byUei = rows\.find\(\(row\) => text\(row\.uei\) && anchors\.ueis\.has\(text\(row\.uei\)\)\)/);
assert.doesNotMatch(service, /AND \(\(\$\{cardPhone\} <> '' AND "cardPhone" = \$\{cardPhone\}\) OR \(\$\{uei\} <> '' AND "uei" = \$\{uei\}\)\)\s*ORDER BY "verifiedAt"/);

console.log('communication identity anchor regression: ok');
