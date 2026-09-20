import assert from 'node:assert/strict';
import fs from 'node:fs';

const communication = fs.readFileSync('server/src/communication/communication.service.ts', 'utf8');
const dispatch = fs.readFileSync('server/src/communication/communication-dispatch.service.ts', 'utf8');
const emailChannel = fs.readFileSync('server/src/communication/email-channel.service.ts', 'utf8');
const notification = fs.readFileSync('server/src/notification/notification.service.ts', 'utf8');
const broadcast = fs.readFileSync('server/src/communication/communication-broadcast.service.ts', 'utf8');
const compose = fs.readFileSync('settings/communications/broadcasts/compose/compose.js', 'utf8');
const transactional = fs.readFileSync('server/src/transactional-email/transactional-email.service.ts', 'utf8');
const envExample = fs.readFileSync('server/.env.example', 'utf8');

assert.match(communication, /async emailIdentity\(/);
assert.match(communication, /person\.emails/);
assert.match(dispatch, /channels\.push\('EMAIL'\)/);
assert.match(dispatch, /channel === 'EMAIL'/);
assert.match(dispatch, /email\.sendMessage/);

assert.match(emailChannel, /TransactionalEmailService/);
assert.match(emailChannel, /hasActivePdnConsentForContact\(tenantId, 'EMAIL'/);
assert.match(emailChannel, /purpose === 'MARKETING'/);
assert.match(emailChannel, /canSendMarketing\(tenantId, 'EMAIL'/);
assert.match(emailChannel, /pendingEmailDeliveries/);
assert.match(emailChannel, /markEmailSent/);
assert.match(emailChannel, /markEmailFailed/);
assert.match(emailChannel, /recordMessage[\s\S]*channel: 'EMAIL'/);

assert.match(notification, /ACTIVE_EXTERNAL_CHANNELS = new Set\(\['TELEGRAM', 'EMAIL'\]\)/);
assert.match(notification, /pendingEmailDeliveries/);
assert.match(notification, /canSendEmailDelivery/);

assert.match(broadcast, /channel === 'EMAIL'/);
assert.match(broadcast, /\['TELEGRAM', 'EMAIL'\]\.includes\(preview\.channel\)/);
assert.match(compose, /value: 'EMAIL', label: 'Email'/);

assert.match(transactional, /import \* as nodemailer from 'nodemailer'/);
assert.doesNotMatch(transactional, /import nodemailer from 'nodemailer'/);
assert.match(transactional, /postbox\.cloud\.yandex\.net/);
assert.match(transactional, /port: 587/);
assert.match(transactional, /secure: false/);
assert.match(transactional, /requireTLS: true/);
assert.match(transactional, /connectionTimeout: 8000/);
assert.match(transactional, /greetingTimeout: 8000/);
assert.match(transactional, /socketTimeout: 15000/);
assert.match(transactional, /Postbox send failed/);
assert.match(transactional, /POSTBOX_API_KEY_ID/);
assert.match(transactional, /POSTBOX_API_KEY_SECRET/);
assert.match(transactional, /X-Message-Tag/);
assert.doesNotMatch(transactional, /smtp\.yandex\.ru|YANDEX_SMTP|X-Book-Tag/i);
assert.match(envExample, /TRANSACTIONAL_EMAIL_PROVIDER="yandex-postbox"/);
assert.match(envExample, /POSTBOX_API_KEY_ID=/);
assert.match(envExample, /POSTBOX_API_KEY_SECRET=/);
assert.match(envExample, /TRANSACTIONAL_EMAIL_FROM_EMAIL=/);
assert.match(envExample, /EMAIL_DELIVERY_POLL_MS=/);
assert.doesNotMatch(envExample, /YANDEX_SMTP/);

console.log('Email channel contract tests passed');
