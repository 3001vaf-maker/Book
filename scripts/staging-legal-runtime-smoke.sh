#!/usr/bin/env bash
set -euo pipefail

base="http://localhost:8080/api"
compose="docker compose -f docker-compose.staging.yml"
staging_password=$($compose exec -T backend printenv OWNER_PASSWORD | tr -d '\r')
login_body=$(node -e 'process.stdout.write(JSON.stringify({email:"staging@book.local",password:process.argv[1]}))' "$staging_password")
login_payload=$(curl -fsS -H 'Content-Type: application/json' -d "$login_body" "$base/auth/login")
master_token=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.accessToken)process.exit(1);process.stdout.write(p.accessToken)' "$login_payload")
tenant_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.tenant?.id)process.exit(1);process.stdout.write(p.tenant.id)' "$login_payload")
user_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.user?.id)process.exit(1);process.stdout.write(p.user.id)' "$login_payload")
auth=(-H "Authorization: Bearer $master_token")
json_header=(-H 'Content-Type: application/json')

expect_status() {
  local expected="$1" method="$2" url="$3" body="${4-}"
  local status
  if [ -n "$body" ]; then
    status=$(curl -sS -o /tmp/book-legal-smoke-response.json -w '%{http_code}' -X "$method" "${auth[@]}" "${json_header[@]}" -d "$body" "$url")
  else
    status=$(curl -sS -o /tmp/book-legal-smoke-response.json -w '%{http_code}' -X "$method" "${auth[@]}" "$url")
  fi
  if [ "$status" != "$expected" ]; then
    echo "Expected HTTP $expected, got $status for $method $url" >&2
    cat /tmp/book-legal-smoke-response.json >&2 || true
    exit 1
  fi
}

platform=$(curl -fsS "${auth[@]}" "$base/platform/legal/readiness")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.status!=="LEGAL_READY"||p.state?.filingStatus!=="SUBMITTED")process.exit(1);const d=Array.isArray(p.documents)?p.documents:[];for(const k of ["privacy-policy","saas-agreement","master-pd-consent","marketing-consent","public-profile-consent","dpa"]){if(!d.some(x=>x.key===k&&x.currentVersion))process.exit(1)}' "$platform"
document_history=$(curl -fsS "${auth[@]}" "$base/platform/legal/document-history")
node -e 'const h=JSON.parse(process.argv[1]);if(!Array.isArray(h)||h.length<6)process.exit(1)' "$document_history"
tenant=$(curl -fsS "${auth[@]}" "$base/legal/readiness")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.operationMode!=="LIVE"||p.state?.filingStatus!=="SUBMITTED")process.exit(1)' "$tenant"
expect_status 400 POST "$base/platform/legal/documents" '{}'
expect_status 409 POST "$base/legal/documents" '{}'

# Authorization must be refreshed from the database on every request: a stale JWT cannot bypass suspension.
$compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1 -v tenant_id="$tenant_id" <<'SQL' >/dev/null
UPDATE "TenantAccess" SET "status"='SUSPENDED', "updatedAt"=CURRENT_TIMESTAMP WHERE "tenantId"=:'tenant_id';
SQL
expect_status 403 GET "$base/auxiliary-state"
$compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1 -v tenant_id="$tenant_id" <<'SQL' >/dev/null
UPDATE "TenantAccess" SET "status"='ACTIVE', "updatedAt"=CURRENT_TIMESTAMP WHERE "tenantId"=:'tenant_id';
SQL
expect_status 200 GET "$base/auxiliary-state"

# Capability resolution must be fail-closed even for the Book owner tenant when an explicit override disables publication.
$compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1 -v tenant_id="$tenant_id" <<'SQL' >/dev/null
INSERT INTO "TenantCapabilityOverride" ("id", "tenantId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'staging-legal-online-booking-off', :'tenant_id', c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Capability" c WHERE c."key"='online_booking.access'
ON CONFLICT ("tenantId", "capabilityId") DO UPDATE SET "enabled"=false, "updatedAt"=CURRENT_TIMESTAMP;
SQL
expect_status 403 GET "$base/online-booking/$tenant_id/context"
$compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1 -v tenant_id="$tenant_id" <<'SQL' >/dev/null
DELETE FROM "TenantCapabilityOverride" o USING "Capability" c
WHERE o."tenantId"=:'tenant_id' AND o."capabilityId"=c."id" AND c."key"='online_booking.access';
SQL
expect_status 200 GET "$base/online-booking/$tenant_id/context"

# DEMO must immediately block real-client, public-booking, finance and communication mutation paths.
demo=$(curl -fsS -X POST "${auth[@]}" "${json_header[@]}" -d '{"reason":"staging legal negative smoke"}' "$base/legal/demo")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.operationMode!=="DEMO")process.exit(1)' "$demo"
expect_status 403 GET "$base/online-booking/$tenant_id/context"
expect_status 403 PUT "$base/auxiliary-state/finance" '{"items":[]}'
expect_status 403 POST "$base/auxiliary-state/migrate" '{}'
expect_status 403 PUT "$base/online-booking/owner/accounts/sync" '{"accounts":[]}'
expect_status 403 PUT "$base/communications/chat/preferences" '{"phone":"+79990000000","preferredChannels":["TELEGRAM"]}'
expect_status 403 PATCH "$base/communications/chat/messages/not-a-real-message" '{"body":"blocked"}'
expect_status 403 DELETE "$base/communications/chat/messages/not-a-real-message"
expect_status 403 POST "$base/communications/broadcasts/groups" '{"name":"blocked","personKeys":["demo-client-anna"]}'
expect_status 403 POST "$base/communications/broadcasts/send" '{"channel":"TELEGRAM","all":true,"name":"blocked","body":"blocked"}'

# Restore LIVE through the real legal transition, not by bypassing the runtime policy.
live=$(curl -fsS -X POST "${auth[@]}" "$base/legal/live")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.operationMode!=="LIVE")process.exit(1)' "$live"
expect_status 200 GET "$base/online-booking/$tenant_id/context"

# PRE_LAUNCH must stop public operations and new real master invitations immediately.
prelaunch=$(curl -fsS -X POST "${auth[@]}" "${json_header[@]}" -d '{"reason":"staging platform negative smoke"}' "$base/platform/legal/pre-launch")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.status!=="PRE_LAUNCH")process.exit(1)' "$prelaunch"
expect_status 403 GET "$base/online-booking/$tenant_id/context"
expect_status 403 POST "$base/saas-admin/invitations" '{"email":"must-not-send@book.local","name":"Blocked"}'
expect_status 403 POST "$base/saas-admin/manual-invitations" '{}'

ready=$(curl -fsS -X POST "${auth[@]}" "$base/platform/legal/legal-ready")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.status!=="LEGAL_READY")process.exit(1)' "$ready"
expect_status 200 GET "$base/online-booking/$tenant_id/context"

# LEGAL_READY may create a master invitation, but the new tenant must remain DEMO and legal evidence must use the User id, not PlatformAdmin id.
invite=$(curl -fsS -X POST "${auth[@]}" "${json_header[@]}" -d '{"email":"legal-smoke-master@book.local","name":"Legal Smoke"}' "$base/saas-admin/invitations")
invited_tenant_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.tenantId)process.exit(1);process.stdout.write(p.tenantId)' "$invite")
invited_mode=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT \"operationMode\" FROM \"TenantLegalState\" WHERE \"tenantId\"='$invited_tenant_id';")
test "$invited_mode" = "DEMO"
created_actor=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COALESCE(\"actorUserId\", '') FROM \"LegalStateEvent\" WHERE \"tenantId\"='$invited_tenant_id' AND \"changeType\"='TENANT_CREATED_DEMO' ORDER BY \"occurredAt\" DESC LIMIT 1;")
test "$created_actor" = "$user_id"

# The manual-link master path must use the same legal chain: platform docs -> acceptance -> DEMO -> tenant docs -> filing -> LIVE.
manual_invite=$(curl -fsS -X POST "${auth[@]}" "$base/saas-admin/manual-invitations")
manual_tenant_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.tenantId||!p.url)process.exit(1);process.stdout.write(p.tenantId)' "$manual_invite")
manual_token=$(node -e 'const p=JSON.parse(process.argv[1]);const u=new URL(p.url);const t=u.searchParams.get("token");if(!t)process.exit(1);process.stdout.write(t)' "$manual_invite")
manual_mode=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT \"operationMode\" FROM \"TenantLegalState\" WHERE \"tenantId\"='$manual_tenant_id';")
test "$manual_mode" = "DEMO"

manual_inspect=$(curl -fsS -H 'Content-Type: application/json' -d "{\"token\":\"$manual_token\"}" "$base/manual-invitations/inspect")
node -e 'const p=JSON.parse(process.argv[1]);const d=Array.isArray(p.documents)?p.documents:[];for(const k of ["privacy-policy","saas-agreement","dpa","master-pd-consent"]){if(!d.some(x=>x.key===k))process.exit(1)}' "$manual_inspect"

manual_accept_body=$(node -e 'process.stdout.write(JSON.stringify({
  token:process.argv[1],
  name:"Legal",surname:"Master",phone:"+79990000991",email:"manual-legal-master@book.invalid",
  password:"ManualLegal123!",
  saasAgreementAccepted:true,dpaAccepted:true,privacyAcknowledged:true,pdConsentAccepted:true,marketingConsentAccepted:false
}))' "$manual_token")
manual_account=$(curl -fsS -H 'Content-Type: application/json' -d "$manual_accept_body" "$base/manual-invitations/accept")
manual_master_token=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.accessToken||p.legal?.operationMode!=="DEMO")process.exit(1);process.stdout.write(p.accessToken)' "$manual_account")
manual_auth=(-H "Authorization: Bearer $manual_master_token")
manual_acceptance_count=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COUNT(*) FROM \"LegalAcceptanceEvent\" WHERE \"tenantId\"='$manual_tenant_id' AND \"source\"='manual-master-registration';")
test "${manual_acceptance_count:-0}" -ge 4
manual_dpa=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COALESCE((\"checklist\"->>'dpaAccepted')::boolean,false) FROM \"TenantLegalState\" WHERE \"tenantId\"='$manual_tenant_id';")
test "$manual_dpa" = "t"

publish_tenant_doc() {
  local key="$1" type="$2" title="$3"
  local body
  body=$(node -e 'process.stdout.write(JSON.stringify({
    key:process.argv[1],type:process.argv[2],title:process.argv[3],
    content:"Synthetic staging legal document for "+process.argv[1],
    operatorIdentity:{name:"Synthetic Legal Master",inn:"000000000000",email:"manual-legal-master@book.invalid"},
    requiredForRegistration:false,requiredForLive:true,requiredForPublicBooking:true
  }))' "$key" "$type" "$title")
  curl -fsS -X POST "${manual_auth[@]}" -H 'Content-Type: application/json' -d "$body" "$base/legal/documents" >/dev/null
}
publish_tenant_doc "privacy-policy" "PRIVACY_POLICY" "Synthetic privacy policy"
publish_tenant_doc "client-pd-consent" "CLIENT_PD_CONSENT" "Synthetic client PD consent"
publish_tenant_doc "service-offer" "SERVICE_OFFER" "Synthetic service offer"

curl -fsS -X PUT "${manual_auth[@]}" -H 'Content-Type: application/json' -d '{"checklist":{"rknFilingPrepared":true}}' "$base/legal/checklist" >/dev/null
manual_prepared=$(curl -fsS -X POST "${manual_auth[@]}" "$base/legal/filing/prepared")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.filingStatus!=="PREPARED")process.exit(1)' "$manual_prepared"
manual_submitted=$(curl -fsS -X POST "${manual_auth[@]}" -H 'Content-Type: application/json' -d '{"submissionReference":"STAGING-MANUAL-MASTER-FILING","evidenceMetadata":{"synthetic":true}}' "$base/legal/filing/submitted")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.filingStatus!=="SUBMITTED"||p.canBecomeLive!==true)process.exit(1)' "$manual_submitted"
manual_live=$(curl -fsS -X POST "${manual_auth[@]}" "$base/legal/live")
node -e 'const p=JSON.parse(process.argv[1]);if(p.state?.operationMode!=="LIVE")process.exit(1)' "$manual_live"

# The email invitation path must enforce the same legal package and enter DEMO.
email_token="staging-email-legal-token"
email_hash=$(node -e 'const {createHash}=require("crypto");process.stdout.write(createHash("sha256").update(process.argv[1]).digest("hex"))' "$email_token")
email_tenant_id="staging-email-legal-tenant"
email_invitation_id="staging-email-legal-invitation"
$compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1   -v tenant_id="$email_tenant_id" -v invitation_id="$email_invitation_id" -v token_hash="$email_hash" <<'SQL' >/dev/null
INSERT INTO "Tenant" ("id","name","createdAt","updatedAt")
VALUES (:'tenant_id','Email Legal Master',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TenantAccess" ("tenantId","status","isOwnerBook","createdAt","updatedAt")
VALUES (:'tenant_id','ACTIVE',false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId") DO UPDATE SET "status"='ACTIVE',"isOwnerBook"=false,"updatedAt"=CURRENT_TIMESTAMP;
INSERT INTO "TenantLegalState" ("tenantId","operationMode","filingStatus","updatedAt")
VALUES (:'tenant_id','DEMO','NOT_PREPARED',CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId") DO UPDATE SET "operationMode"='DEMO',"filingStatus"='NOT_PREPARED',"updatedAt"=CURRENT_TIMESTAMP;
INSERT INTO "MasterInvitation" ("id","tenantId","createdByAdminId","email","name","tokenHash","status","expiresAt","createdAt","updatedAt")
SELECT :'invitation_id', :'tenant_id', pa."id", 'email-legal-master@book.invalid', 'Email Legal Master', :'token_hash', 'PENDING',
       CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PlatformAdmin" pa
LIMIT 1
ON CONFLICT ("id") DO NOTHING;
SQL

email_inspect=$(curl -fsS -H 'Content-Type: application/json' -d "{\"token\":\"$email_token\"}" "$base/master-invitations/inspect")
node -e 'const p=JSON.parse(process.argv[1]);if(p.tenant?.id!=="staging-email-legal-tenant")process.exit(1);const r=Array.isArray(p.legal?.required)?p.legal.required:[];for(const k of ["privacy-policy","saas-agreement","dpa","master-pd-consent"]){if(!r.some(x=>x.key===k))process.exit(1)}' "$email_inspect"

email_documents=$(curl -fsS -H 'Content-Type: application/json' -d '{}' "$base/master-invitations/documents")
node -e 'const d=JSON.parse(process.argv[1]);if(!Array.isArray(d))process.exit(1);for(const k of ["privacy-policy","saas-agreement","dpa","master-pd-consent"]){if(!d.some(x=>x.key===k))process.exit(1)}' "$email_documents"

email_accept_body=$(node -e 'process.stdout.write(JSON.stringify({
  token:process.argv[1],password:"EmailLegal123!",
  saasAgreementAccepted:true,dpaAccepted:true,privacyAcknowledged:true,pdConsentAccepted:true,marketingConsentAccepted:false
}))' "$email_token")
email_account=$(curl -fsS -H 'Content-Type: application/json' -d "$email_accept_body" "$base/master-invitations/accept")
node -e 'const p=JSON.parse(process.argv[1]);if(!p.accessToken||p.legal?.operationMode!=="DEMO"||p.tenant?.id!=="staging-email-legal-tenant")process.exit(1)' "$email_account"
email_acceptance_count=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COUNT(*) FROM \"LegalAcceptanceEvent\" WHERE \"tenantId\"='$email_tenant_id' AND \"source\"='master-registration';")
test "${email_acceptance_count:-0}" -ge 4
email_dpa=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COALESCE((\"checklist\"->>'dpaAccepted')::boolean,false) FROM \"TenantLegalState\" WHERE \"tenantId\"='$email_tenant_id';")
test "$email_dpa" = "t"

# Published legal evidence must be immutable in PostgreSQL itself, not only through service code.
version_count=$($compose exec -T db psql -U book -d book_staging -At -c 'SELECT COUNT(*) FROM "LegalDocumentVersion";')
test "${version_count:-0}" -gt 0
if $compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1 -c 'UPDATE "LegalDocumentVersion" SET "contentSnapshot"="contentSnapshot" || '\'' tampered'\'' WHERE "id"=(SELECT "id" FROM "LegalDocumentVersion" LIMIT 1);' >/dev/null 2>&1; then
  echo 'LegalDocumentVersion content unexpectedly mutable' >&2
  exit 1
fi

state_event_count=$($compose exec -T db psql -U book -d book_staging -At -c 'SELECT COUNT(*) FROM "LegalStateEvent";')
test "${state_event_count:-0}" -gt 0
if $compose exec -T db psql -U book -d book_staging -v ON_ERROR_STOP=1 -c 'DELETE FROM "LegalStateEvent" WHERE "id"=(SELECT "id" FROM "LegalStateEvent" LIMIT 1);' >/dev/null 2>&1; then
  echo 'LegalStateEvent unexpectedly mutable' >&2
  exit 1
fi

# Verify the negative checks produced legal policy evidence for the same tenant.
audit_count=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COUNT(*) FROM \"LegalAuditEvent\" WHERE \"tenantId\"='$tenant_id' AND \"result\"='DENIED';")
test "${audit_count:-0}" -gt 0

# The platform-admin identity used above must still be the authenticated DB identity.
admin_count=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COUNT(*) FROM \"PlatformAdmin\" WHERE \"userId\"='$user_id';")
test "$admin_count" = "1"

echo "legal runtime negative/positive smoke: ok"
