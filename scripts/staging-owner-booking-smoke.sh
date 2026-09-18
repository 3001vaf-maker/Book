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

# Old runtime state must be irrelevant to the working application.
$compose exec -T db psql -U book -d book_staging -v tenant_id="$tenant_id" <<'SQL'
DELETE FROM "BookingPublication" WHERE "tenantId" = :'tenant_id';
DELETE FROM "TenantLegalState" WHERE "tenantId" = :'tenant_id';

UPDATE "PlatformLegalState"
SET "status" = 'PRE_LAUNCH', "legalReadyAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'platform';
SQL

login_body=$(node -e 'process.stdout.write(JSON.stringify({email:process.argv[1],password:process.argv[2]}))' "$owner_email" "$owner_password")
login_payload=$(curl -fsS -H 'Content-Type: application/json' -d "$login_body" "$base/auth/login")
owner_token=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.accessToken)process.exit(1); process.stdout.write(p.accessToken)' "$login_payload")
login_tenant=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.tenant?.id)process.exit(1); process.stdout.write(p.tenant.id)' "$login_payload")
test "$login_tenant" = "$tenant_id"

# Owner still has normal authenticated access.
access_payload=$(curl -fsS -H "Authorization: Bearer $owner_token" "$base/saas-access/me")
node -e '
const p=JSON.parse(process.argv[1]);
if(p.status!=="ACTIVE" || p.isOwnerBook!==true) process.exit(1);
' "$access_payload"

# Public booking must work directly from profile/workplace/procedures, with no publication/legal state.
context=$(curl -fsS "$base/online-booking/$tenant_id/context?workplace=studio-test")
node -e '
const p=JSON.parse(process.argv[1]);
if(p.tenantId!==process.argv[2]) process.exit(1);
if(!p.profile || !p.profile.name) process.exit(1);
if(!Array.isArray(p.workplaces) || !p.workplaces.some(x=>x.key==="studio-test")) process.exit(1);
const ids=new Set((p.procedures||[]).map(x=>x.id));
if(!ids.has("procedure-cut") || !ids.has("procedure-color")) process.exit(1);
' "$context" "$tenant_id"

publication_count=$($compose exec -T db psql -U book -d book_staging -At -v tenant_id="$tenant_id" -c 'SELECT COUNT(*) FROM "BookingPublication" WHERE "tenantId" = :'\''tenant_id'\'';' | tr -d '\r')
legal_count=$($compose exec -T db psql -U book -d book_staging -At -v tenant_id="$tenant_id" -c 'SELECT COUNT(*) FROM "TenantLegalState" WHERE "tenantId" = :'\''tenant_id'\'';' | tr -d '\r')
test "$publication_count" = "0"
test "$legal_count" = "0"

echo "owner booking without legacy runtime: ok"
