#!/usr/bin/env bash
set -euo pipefail

base="http://localhost:8080/api"
compose="docker compose -f docker-compose.staging.yml"
owner_email="staging@book.local"
owner_password=$($compose exec -T backend printenv OWNER_PASSWORD | tr -d '\r')

tenant_id=$($compose exec -T db psql -U book -d book_staging -At -v email="$owner_email" -c '
SELECT m."tenantId"
FROM "User" u
JOIN "Membership" m ON m."userId" = u."id" AND m."role" = '\''OWNER'\''
WHERE lower(u."email") = lower(:'\''email'\'')
ORDER BY m."createdAt" ASC
LIMIT 1;
' | tr -d '\r')

test -n "$tenant_id"

# Simulate the broken post-reset owner state without deleting profile/workplace/procedure/document data.
$compose exec -T db psql -U book -d book_staging -v tenant_id="$tenant_id" <<'SQL'
UPDATE "TenantAccess"
SET "status" = 'SUSPENDED', "isOwnerBook" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "tenantId" = :'tenant_id';

DELETE FROM "BookingPublication" WHERE "tenantId" = :'tenant_id';
DELETE FROM "TenantLegalState" WHERE "tenantId" = :'tenant_id';

UPDATE "PlatformLegalState"
SET "status" = 'PRE_LAUNCH', "legalReadyAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'platform';

UPDATE "Profile"
SET "migrationVerifiedAt" = NULL
WHERE "tenantId" = :'tenant_id';

UPDATE "BusinessStateMeta"
SET "migrationVerifiedAt" = NULL
WHERE "tenantId" = :'tenant_id';

UPDATE "BusinessOperationalState"
SET "migrationVerifiedAt" = NULL
WHERE "tenantId" = :'tenant_id';

UPDATE "BusinessDocumentState"
SET "migrationVerifiedAt" = NULL
WHERE "tenantId" = :'tenant_id';
SQL

login_body=$(node -e 'process.stdout.write(JSON.stringify({email:process.argv[1],password:process.argv[2]}))' "$owner_email" "$owner_password")
login_payload=$(curl -fsS -H 'Content-Type: application/json' -d "$login_body" "$base/auth/login")
owner_token=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.accessToken)process.exit(1); process.stdout.write(p.accessToken)' "$login_payload")
login_tenant=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.tenant?.id)process.exit(1); process.stdout.write(p.tenant.id)' "$login_payload")
test "$login_tenant" = "$tenant_id"

# Any authenticated owner request must reassert ACTIVE owner access and full capabilities.
access_payload=$(curl -fsS -H "Authorization: Bearer $owner_token" "$base/saas-access/me")
node -e '
const p=JSON.parse(process.argv[1]);
if(p.status!=="ACTIVE" || p.isOwnerBook!==true) process.exit(1);
const cap=(p.capabilities||[]).find(x=>x.key==="online_booking.access");
if(!cap || cap.enabled!==true) process.exit(1);
' "$access_payload"

# Owner publication must work with no tenant LIVE state and with platform PRE_LAUNCH.
publication=$(curl -fsS -X PUT   -H "Authorization: Bearer $owner_token"   -H 'Content-Type: application/json'   -d '{"data":{"source":"owner-booking-smoke"}}'   "$base/online-booking/owner/publication")
node -e 'const p=JSON.parse(process.argv[1]); if(!p.revision)process.exit(1)' "$publication"

# Remove the publication once more: the public route itself must self-heal it for owner workspace.
$compose exec -T db psql -U book -d book_staging -v tenant_id="$tenant_id" -c   'DELETE FROM "BookingPublication" WHERE "tenantId" = :'\''tenant_id'\'';' >/dev/null

context=$(curl -fsS "$base/online-booking/$tenant_id/context?workplace=studio-test")
node -e '
const p=JSON.parse(process.argv[1]);
if(p.tenantId!==process.argv[2]) process.exit(1);
if(!Array.isArray(p.workplaces) || !p.workplaces.some(x=>x.key==="studio-test")) process.exit(1);
const ids=new Set((p.procedures||[]).map(x=>x.id));
if(!ids.has("procedure-cut") || !ids.has("procedure-color")) process.exit(1);
if(!p.profile || !p.profile.name) process.exit(1);
' "$context" "$tenant_id"

# Confirm that technical verification flags and publication were restored without replacing data.
$compose exec -T db psql -U book -d book_staging -At -v tenant_id="$tenant_id" -c '
SELECT
  CASE WHEN ta."status" = '\''ACTIVE'\'' AND ta."isOwnerBook" THEN 1 ELSE 0 END,
  CASE WHEN bp."tenantId" IS NOT NULL THEN 1 ELSE 0 END,
  CASE WHEN p."migrationVerifiedAt" IS NOT NULL THEN 1 ELSE 0 END,
  CASE WHEN bo."migrationVerifiedAt" IS NOT NULL THEN 1 ELSE 0 END,
  CASE WHEN bd."migrationVerifiedAt" IS NOT NULL THEN 1 ELSE 0 END
FROM "TenantAccess" ta
LEFT JOIN "BookingPublication" bp ON bp."tenantId" = ta."tenantId"
LEFT JOIN "Profile" p ON p."tenantId" = ta."tenantId"
LEFT JOIN "BusinessOperationalState" bo ON bo."tenantId" = ta."tenantId"
LEFT JOIN "BusinessDocumentState" bd ON bd."tenantId" = ta."tenantId"
WHERE ta."tenantId" = :'\''tenant_id'\''
LIMIT 1;
' | grep -q '^1|1|1|1|1$'

echo "owner booking recovery smoke: ok"
