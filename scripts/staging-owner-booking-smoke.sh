#!/usr/bin/env bash
set -euo pipefail

base="http://localhost:8080/api"
compose="docker compose -f docker-compose.staging.yml"
owner_email="staging@book.local"
owner_password=$($compose exec -T backend printenv OWNER_PASSWORD | tr -d '\r')

login_body=$(node -e 'process.stdout.write(JSON.stringify({email:process.argv[1],password:process.argv[2]}))' "$owner_email" "$owner_password")
login_payload=$(curl -fsS -H 'Content-Type: application/json' -d "$login_body" "$base/auth/login")
owner_token=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.accessToken)process.exit(1); process.stdout.write(p.accessToken)' "$login_payload")
tenant_id=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.tenant?.id)process.exit(1); process.stdout.write(p.tenant.id)' "$login_payload")
test -n "$tenant_id"

# Owner still has normal authenticated access.
access_payload=$(curl -fsS -H "Authorization: Bearer $owner_token" "$base/saas-access/me")
node -e '
const p=JSON.parse(process.argv[1]);
if(p.status!=="ACTIVE" || p.isPlatformOwnerWorkspace!==true) process.exit(1);
' "$access_payload"

# Public booking must work directly from profile/workplace/procedures.
context=$(curl -fsS "$base/online-booking/$tenant_id/context?workplace=studio-test")
node -e '
const p=JSON.parse(process.argv[1]);
if(p.tenantId!==process.argv[2]) process.exit(1);
if(!p.profile || !p.profile.name) process.exit(1);
if(!Array.isArray(p.workplaces) || !p.workplaces.some(x=>x.key==="studio-test")) process.exit(1);
const ids=new Set((p.procedures||[]).map(x=>x.id));
if(!ids.has("procedure-cut") || !ids.has("procedure-color")) process.exit(1);
' "$context" "$tenant_id"

echo "owner booking without legacy runtime: ok"
