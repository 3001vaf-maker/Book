#!/usr/bin/env bash
set -euo pipefail

base="http://localhost:8080/api"
compose="docker compose -f docker-compose.staging.yml"
staging_password=$($compose exec -T backend printenv OWNER_PASSWORD | tr -d '\r')
login_body=$(node -e 'process.stdout.write(JSON.stringify({email:"staging@book.local",password:process.argv[1]}))' "$staging_password")
login_payload=$(curl -fsS -H 'Content-Type: application/json' -d "$login_body" "$base/auth/login")
master_token=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.accessToken)process.exit(1); process.stdout.write(p.accessToken)' "$login_payload")
tenant_id=$(node -e 'const p=JSON.parse(process.argv[1]); if(!p.tenant?.id)process.exit(1); process.stdout.write(p.tenant.id)' "$login_payload")
password="Profile-Smoke-Aa1!"

register() {
  local email="$1" name="$2" phone="$3"
  local body
  body=$(node -e 'process.stdout.write(JSON.stringify({email:process.argv[1],password:process.argv[2],name:process.argv[3],phone:process.argv[4],consents:[]}))' "$email" "$password" "$name" "$phone")
  curl -fsS -H 'Content-Type: application/json' -d "$body" "$base/online-booking/$tenant_id/account/register"
}

# Two different phones begin as two different profiles/chats.
first=$(register 'profile-one@book.local' 'Анна' '+79990000991')
second=$(register 'profile-two@book.local' 'Анна дубль' '+79990000992')
first_token=$(node -e 'const p=JSON.parse(process.argv[1]);process.stdout.write(p.accessToken)' "$first")
second_token=$(node -e 'const p=JSON.parse(process.argv[1]);process.stdout.write(p.accessToken)' "$second")
first_account=$(node -e 'const p=JSON.parse(process.argv[1]);process.stdout.write(p.account.id)' "$first")
second_account=$(node -e 'const p=JSON.parse(process.argv[1]);process.stdout.write(p.account.id)' "$second")

for spec in "$first_token|profile-one|one" "$second_token|profile-two|two"; do
  IFS='|' read -r token suffix key <<<"$spec"
  curl -fsS -X PUT -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d "{\"subscription\":{\"endpoint\":\"https://push.example.invalid/$suffix\",\"keys\":{\"p256dh\":\"staging-p256dh-$key\",\"auth\":\"staging-auth-$key\"}}}" \
    "$base/online-booking/$tenant_id/account/push/subscription" >/dev/null
done

first_msg=$(curl -fsS -X POST -H "Authorization: Bearer $first_token" -H 'Content-Type: application/json' \
  -d '{"body":"Первое сообщение 🙂","content":{"version":1,"blocks":[{"type":"paragraph","spans":[{"text":"Первое сообщение 🙂","marks":["italic"]}]}]}}' \
  "$base/online-booking/$tenant_id/account/internal-chat/messages")
second_msg=$(curl -fsS -X POST -H "Authorization: Bearer $second_token" -H 'Content-Type: application/json' \
  -d '{"body":"Сообщение дубля ✨","content":{"version":1,"blocks":[{"type":"paragraph","spans":[{"text":"Сообщение дубля ✨","marks":["bold"]}]}]}}' \
  "$base/online-booking/$tenant_id/account/internal-chat/messages")

first_msg_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(p.actorAccountId!==process.argv[2]||p.actorName!=="Анна"||p.channel!=="IN_APP")process.exit(1);process.stdout.write(p.id)' "$first_msg" "$first_account")
second_msg_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(p.actorAccountId!==process.argv[2]||p.actorName!=="Анна дубль"||p.channel!=="IN_APP")process.exit(1);process.stdout.write(p.id)' "$second_msg" "$second_account")
first_profile=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).profileKey)' "$first_msg")
second_profile=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).profileKey)' "$second_msg")
test -n "$first_profile" && test -n "$second_profile" && test "$first_profile" != "$second_profile"

# A different login email with the already-known phone must attach to the same BusinessPerson profile.
same_phone=$(register 'profile-same-phone@book.local' 'Анна второй вход' '+79990000991')
same_phone_token=$(node -e 'const p=JSON.parse(process.argv[1]);process.stdout.write(p.accessToken)' "$same_phone")
same_phone_msg=$(curl -fsS -X POST -H "Authorization: Bearer $same_phone_token" -H 'Content-Type: application/json' \
  -d '{"body":"Тот же телефон, другой вход"}' "$base/online-booking/$tenant_id/account/internal-chat/messages")
node -e 'const p=JSON.parse(process.argv[1]);if(p.profileKey!==process.argv[2])process.exit(1)' "$same_phone_msg" "$first_profile"

separate=$(curl -fsS -H "Authorization: Bearer $master_token" "$base/communications/chat/threads")
node -e 'const rows=JSON.parse(process.argv[1]),ks=new Set(rows.map(x=>x.threadProfileKey));if(!ks.has(process.argv[2])||!ks.has(process.argv[3]))process.exit(1)' "$separate" "$first_profile" "$second_profile"

# The master explicitly decides the two duplicate profiles are the same person via UEI.
$compose exec -T db psql -U book -d book_staging -v tenant_id="$tenant_id" -v first_profile="$first_profile" -v second_profile="$second_profile" <<'SQL'
UPDATE "BusinessIdentityState"
SET "data" = jsonb_build_object(
  'entities', jsonb_build_object('SAME', jsonb_build_object(
    'uei','SAME','owner',jsonb_build_object('type','person','id',:'first_profile'),
    'members',jsonb_build_array('person:'||:'first_profile','person:'||:'second_profile'),
    'history','[]'::jsonb,'reserved',true)),
  'relations', jsonb_build_object('person:'||:'first_profile','SAME','person:'||:'second_profile','SAME'),
  'revoked','[]'::jsonb),
  "updatedAt"=CURRENT_TIMESTAMP
WHERE "tenantId"=:'tenant_id';
SQL

merged=$(curl -fsS -H "Authorization: Bearer $master_token" "$base/communications/chat/threads")
node -e 'const rows=JSON.parse(process.argv[1]);if(rows.filter(x=>x.threadProfileKey===process.argv[2]).length!==1||rows.some(x=>x.threadProfileKey===process.argv[3]))process.exit(1)' "$merged" "$first_profile" "$second_profile"

for token in "$first_token" "$second_token" "$same_phone_token"; do
  thread=$(curl -fsS -H "Authorization: Bearer $token" "$base/online-booking/$tenant_id/account/internal-chat")
  node -e 'const rows=JSON.parse(process.argv[1]),ids=new Set(rows.map(x=>x.id));if(!ids.has(process.argv[2])||!ids.has(process.argv[3]))process.exit(1)' "$thread" "$first_msg_id" "$second_msg_id"
done

linked=$(curl -fsS -X POST -H "Authorization: Bearer $second_token" -H 'Content-Type: application/json' -d '{"body":"Пишет второй исходный профиль после связи ✅"}' "$base/online-booking/$tenant_id/account/internal-chat/messages")
node -e 'const p=JSON.parse(process.argv[1]);if(p.actorName!=="Анна дубль"||p.actorUei!=="SAME"||p.profileKey!==process.argv[2])process.exit(1)' "$linked" "$second_profile"

master_reply=$(curl -fsS -X POST -H "Authorization: Bearer $master_token" -H 'Content-Type: application/json' \
  -d "{\"profileKey\":\"$first_profile\",\"body\":\"Ответ профилю ✅\",\"content\":{\"version\":1,\"blocks\":[{\"type\":\"heading\",\"spans\":[{\"text\":\"Ответ профилю ✅\",\"marks\":[\"bold\",\"underline\"]}]}]}}" \
  "$base/communications/chat/messages")
master_msg_id=$(node -e 'const p=JSON.parse(process.argv[1]);if(!p.id||p.profileKey!==process.argv[2]||p.actorAccountId!==null||p.channel!=="IN_APP"||p.direction!=="outbound")process.exit(1);process.stdout.write(p.id)' "$master_reply" "$first_profile")

for token in "$first_token" "$second_token" "$same_phone_token"; do
  thread=$(curl -fsS -H "Authorization: Bearer $token" "$base/online-booking/$tenant_id/account/internal-chat")
  node -e 'const rows=JSON.parse(process.argv[1]);if(!rows.some(x=>x.id===process.argv[2]&&x.body==="Ответ профилю ✅"))process.exit(1)' "$thread" "$master_msg_id"
done

# Only the two devices that actually subscribed receive Push; the third linked account has no device subscription.
push_count=$($compose exec -T db psql -U book -d book_staging -At -c "SELECT COUNT(*) FROM \"NotificationDelivery\" d JOIN \"Notification\" n ON n.\"id\"=d.\"notificationId\" AND n.\"tenantId\"=d.\"tenantId\" WHERE n.\"tenantId\"='$tenant_id' AND n.\"type\"='chat.message' AND n.\"entityId\"='$master_msg_id' AND d.\"channel\"='PUSH';")
test "$push_count" = "2"

# A dependent may have their own Person/UEI/history but no personal login/contact.
# That dependent is not a direct IN_APP destination; ordinary communication remains on the holder profile.
$compose exec -T db psql -U book -d book_staging -v tenant_id="$tenant_id" <<'SQL'
INSERT INTO "BusinessPerson" ("id", "tenantId", "key", "position", "data", "createdAt", "updatedAt")
VALUES (
  'smoke-dependent-row', :'tenant_id', 'dependent-profile', 999,
  '{"key":"dependent-profile","name":"Дочка","phones":[],"emails":[],"telegrams":[],"accounts":[],"links":[],"tags":[],"programs":[]}'::jsonb,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
UPDATE "BusinessIdentityState"
SET "data" = jsonb_set(
    jsonb_set("data", ARRAY['entities','KID1'], jsonb_build_object(
      'uei','KID1','owner',jsonb_build_object('type','person','id','dependent-profile'),
      'members',jsonb_build_array('person:dependent-profile'),'history','[]'::jsonb,'reserved',true
    ), true),
    ARRAY['relations','person:dependent-profile'], to_jsonb('KID1'::text), true
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "tenantId" = :'tenant_id';
SQL

dependent_status=$(curl -sS -o /tmp/book-dependent-chat.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $master_token" -H 'Content-Type: application/json' \
  -d '{"channel":"IN_APP","profileKey":"dependent-profile","body":"Не должен уйти напрямую"}' \
  "$base/communications/chat/messages")
test "$dependent_status" = "404"
grep -q 'Внутренний чат клиента недоступен' /tmp/book-dependent-chat.json

edited=$(curl -fsS -X PATCH -H "Authorization: Bearer $master_token" -H 'Content-Type: application/json' -d '{"body":"Исправленный ответ ✨","content":{"version":1,"blocks":[{"type":"subheading","spans":[{"text":"Исправленный ответ ✨","marks":["italic"]}]}]}}' "$base/communications/chat/messages/$master_msg_id")
node -e 'const p=JSON.parse(process.argv[1]);if(p.body!=="Исправленный ответ ✨"||!p.editedAt||p.content?.blocks?.[0]?.type!=="subheading")process.exit(1)' "$edited"

deleted=$(curl -fsS -X DELETE -H "Authorization: Bearer $master_token" "$base/communications/chat/messages/$master_msg_id")
node -e 'const p=JSON.parse(process.argv[1]);if(!p.deletedAt||p.body!==""||p.status!=="deleted"||(p.attachments||[]).length)process.exit(1)' "$deleted"

forbidden=$(curl -sS -o /tmp/book-forbidden-edit.json -w '%{http_code}' -X PATCH -H "Authorization: Bearer $first_token" -H 'Content-Type: application/json' -d '{"body":"Нет"}' "$base/online-booking/$tenant_id/account/internal-chat/messages/$second_msg_id")
test "$forbidden" = "400"

client_edited=$(curl -fsS -X PATCH -H "Authorization: Bearer $second_token" -H 'Content-Type: application/json' -d '{"body":"Исправлено вторым профилем 🙂","content":{"version":1,"blocks":[{"type":"paragraph","spans":[{"text":"Исправлено вторым профилем 🙂","marks":["underline"]}]}]}}' "$base/online-booking/$tenant_id/account/internal-chat/messages/$second_msg_id")
node -e 'const p=JSON.parse(process.argv[1]);if(p.body!=="Исправлено вторым профилем 🙂"||!p.editedAt)process.exit(1)' "$client_edited"
client_deleted=$(curl -fsS -X DELETE -H "Authorization: Bearer $second_token" "$base/online-booking/$tenant_id/account/internal-chat/messages/$second_msg_id")
node -e 'const p=JSON.parse(process.argv[1]);if(!p.deletedAt||p.body!==""||p.status!=="deleted")process.exit(1)' "$client_deleted"

echo "profile-owned internal chat smoke: ok"
