import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../server/prisma/migrations/20260916090000_notification_template_overrides/migration.sql', import.meta.url), 'utf8');
const templates = await readFile(new URL('../server/src/notification/notification-template.service.ts', import.meta.url), 'utf8');
const lifecycle = await readFile(new URL('../server/src/notification/booking-lifecycle-notification.service.ts', import.meta.url), 'utf8');
const reminders = await readFile(new URL('../server/src/notification/notification-reminder.service.ts', import.meta.url), 'utf8');
const notificationController = await readFile(new URL('../server/src/notification/notification.controller.ts', import.meta.url), 'utf8');
const notificationModule = await readFile(new URL('../server/src/notification/notification.module.ts', import.meta.url), 'utf8');
const businessController = await readFile(new URL('../server/src/business-state/business-state.controller.ts', import.meta.url), 'utf8');
const bookingController = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const settings = await readFile(new URL('../settings/communications/communications.js', import.meta.url), 'utf8');
const browserTemplates = await readFile(new URL('../core/notifications/templates.js', import.meta.url), 'utf8');
const recordEvents = await readFile(new URL('../core/record/events.js', import.meta.url), 'utf8');
const recordIndex = await readFile(new URL('../core/record/index.js', import.meta.url), 'utf8');
const recordState = await readFile(new URL('../core/record/state.js', import.meta.url), 'utf8');
const recordService = await readFile(new URL('../core/record/service.js', import.meta.url), 'utf8');
const recordPayment = await readFile(new URL('../journal/record-payment.js', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../core/bootstrap.js', import.meta.url), 'utf8');

assert.match(migration, /CREATE TABLE "NotificationTemplateOverride"/);
assert.match(migration, /"enabled" BOOLEAN NOT NULL DEFAULT true/);
assert.match(migration, /CREATE TABLE "NotificationReminderRule"/);
assert.match(migration, /CREATE TABLE "NotificationReminderDelivery"/);
assert.match(migration, /NotificationReminderDelivery_schedule_key/);

for (const key of ['booking.created', 'booking.cancelled', 'booking.rescheduled', 'booking.completed', 'booking.reminder', 'owner.booking.created']) {
  assert.match(templates, new RegExp(key.replaceAll('.', '\\.')));
}
assert.doesNotMatch(templates, /owner\.chat\.message/);
assert.match(templates, /name: 'Напоминание о визите'/);
assert.match(templates, /enabled: override\?\.enabled \?\? true/);
assert.match(templates, /formatNotificationDate/);
assert.match(templates, /formatNotificationTime/);
assert.match(templates, /time_range/);
assert.match(templates, /end_time/);
assert.match(templates, /bookingTemplateValues/);
assert.match(templates, /"enabled" = EXCLUDED\."enabled"/);

assert.match(notificationController, /@Get\('reminder-rules'\)/);
assert.match(notificationController, /@Put\('reminder-rules'\)/);
assert.match(notificationController, /enabled\?: unknown/);
assert.match(notificationModule, /NotificationReminderService/);
assert.match(browserTemplates, /getNotificationReminderRules/);
assert.match(browserTemplates, /saveNotificationReminderRules/);
assert.match(browserTemplates, /enabled: Boolean\(enabled\)/);

assert.match(recordEvents, /COMPLETED: 'completed'/);
assert.match(recordState, /RECORD_EVENT_TYPES\.COMPLETED/);
assert.match(recordState, /completedAt/);
assert.doesNotMatch(recordState, /recordAppointmentTime\(record, 'to'\) <= now/);
assert.match(recordService, /export function completeRecord/);
assert.match(recordIndex, /completeRecord/);
assert.doesNotMatch(recordIndex, /startRecordCompletionRuntime/);
assert.doesNotMatch(bootstrap, /startRecordCompletionRuntime/);
assert.match(bootstrap, /if \(!telegramAuth\?\.halt\) await import\('\.\.\/core\.js'\);/);
assert.match(recordPayment, /completeRecord\(completed\.source\.id\)/);
assert.match(recordPayment, /data-record-complete/);
assert.match(recordPayment, /Завершить/);

assert.match(lifecycle, /booking\.rescheduled/);
assert.match(lifecycle, /booking\.cancelled/);
assert.match(lifecycle, /booking\.completed/);
assert.match(lifecycle, /booking\.reminder/);
assert.match(lifecycle, /isHistoricalNotificationDate/);
assert.match(lifecycle, /isCurrentNotificationMonth/);
assert.match(lifecycle, /completed-outside-current-month/);
assert.match(lifecycle, /template\.enabled/);
assert.match(lifecycle, /eventType !== 'cancelled' && eventType !== 'completed'/);
assert.match(lifecycle, /BookingRequestStatus\.CANCELLED/);
assert.match(lifecycle, /syncRequestSchedule/);
assert.match(lifecycle, /booking\.created/);
assert.match(lifecycle, /bookingTemplateValues/);
assert.match(businessController, /recordBefore/);
assert.match(businessController, /afterRecordUpsert/);
assert.match(businessController, /recordEventExists/);
assert.match(businessController, /afterRecordEventUpsert/);

assert.match(reminders, /implements OnModuleInit, OnModuleDestroy/);
assert.match(reminders, /setInterval/);
assert.match(reminders, /30_000/);
assert.match(reminders, /minutesBefore/);
assert.match(reminders, /scheduleKey/);
assert.match(reminders, /ON CONFLICT \("tenantId", "recordId", "ruleId", "scheduleKey"\) DO NOTHING/);
assert.match(reminders, /types\.has\('cancelled'\)/);
assert.match(reminders, /types\.has\('completed'\)/);
assert.match(reminders, /types\.has\('no-show'\)/);
assert.match(reminders, /notifyReminderForRecord/);

assert.match(bookingController, /bookingTemplateValues/);
assert.match(bookingController, /templates\.render\(tenantId, 'booking\.created'/);
assert.match(bookingController, /clientTemplate\.enabled/);
assert.match(bookingController, /ownerTemplate\.enabled/);
assert.match(bookingController, /channel: 'OWNER_IN_APP'/);

assert.match(settings, /title: 'Клиенту', count: '5'/);
assert.match(settings, /title: 'Мастеру', count: '2'/);
assert.match(settings, /Новое сообщение клиента/);
assert.match(settings, /Отдельный шаблон не нужен/);
assert.match(settings, /Отправлять клиенту/);
assert.match(settings, /За сутки/);
assert.match(settings, /За 3 часа/);
assert.match(settings, /За 1 час/);
assert.match(settings, /За 15 минут/);
assert.match(settings, /name="reminderMinutes"/);
assert.match(settings, /data-template-variable/);
assert.match(settings, /Время процедуры · 12:00-13:00/);
assert.match(settings, /Переносы строк в тексте сохраняются/);
assert.match(settings, /saveNotificationTemplate/);
assert.match(settings, /saveNotificationRouting/);
assert.match(settings, /saveNotificationReminderRules/);

console.log('grouped notification templates regression: ok');
