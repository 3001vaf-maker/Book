import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../server/prisma/migrations/20260916090000_notification_template_overrides/migration.sql', import.meta.url), 'utf8');
const templates = await readFile(new URL('../server/src/notification/notification-template.service.ts', import.meta.url), 'utf8');
const lifecycle = await readFile(new URL('../server/src/notification/booking-lifecycle-notification.service.ts', import.meta.url), 'utf8');
const notificationController = await readFile(new URL('../server/src/notification/notification.controller.ts', import.meta.url), 'utf8');
const businessController = await readFile(new URL('../server/src/business-state/business-state.controller.ts', import.meta.url), 'utf8');
const bookingController = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const settings = await readFile(new URL('../settings/communications/communications.js', import.meta.url), 'utf8');
const browserTemplates = await readFile(new URL('../core/notifications/templates.js', import.meta.url), 'utf8');
const recordEvents = await readFile(new URL('../core/record/events.js', import.meta.url), 'utf8');
const recordState = await readFile(new URL('../core/record/state.js', import.meta.url), 'utf8');
const recordService = await readFile(new URL('../core/record/service.js', import.meta.url), 'utf8');
const completionRuntime = await readFile(new URL('../core/record/completion-runtime.js', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../core/bootstrap.js', import.meta.url), 'utf8');

assert.match(migration, /CREATE TABLE "NotificationTemplateOverride"/);
assert.match(migration, /UNIQUE INDEX "NotificationTemplateOverride_tenantId_templateKey_key"/);

for (const key of ['booking.created', 'booking.cancelled', 'booking.rescheduled', 'booking.completed', 'owner.booking.created']) {
  assert.match(templates, new RegExp(key.replaceAll('.', '\\.')));
}
assert.doesNotMatch(templates, /owner\.chat\.message/);
assert.match(templates, /audience: 'CLIENT'/);
assert.match(templates, /audience: 'MASTER'/);
assert.match(templates, /name: 'Завершение записи'/);
assert.match(templates, /key: 'booking\.completed'[\s\S]*?active: true/);
assert.match(templates, /formatNotificationDate/);
assert.match(templates, /formatNotificationTime/);
assert.match(templates, /time_range/);
assert.match(templates, /end_time/);
assert.match(templates, /bookingTemplateValues/);
assert.match(templates, /replaceVariables/);
assert.match(templates, /ON CONFLICT \("tenantId", "templateKey"\) DO UPDATE/);

assert.match(notificationController, /@Get\('templates'\)/);
assert.match(notificationController, /@Put\('templates\/:templateKey'\)/);
assert.match(browserTemplates, /getNotificationTemplates/);
assert.match(browserTemplates, /saveNotificationTemplate/);

assert.match(recordEvents, /COMPLETED: 'completed'/);
assert.match(recordState, /RECORD_EVENT_TYPES\.COMPLETED/);
assert.match(recordState, /completedAt/);
assert.match(recordService, /export function completeRecord/);
assert.match(completionRuntime, /sweepCompletedRecords/);
assert.match(completionRuntime, /COMPLETION_ROLLOUT_DATE = '2026-09-16'/);
assert.match(completionRuntime, /recordAppointmentTime\(record, 'to'\)/);
assert.match(bootstrap, /record\/completion-runtime\.js/);

assert.match(lifecycle, /booking\.rescheduled/);
assert.match(lifecycle, /booking\.cancelled/);
assert.match(lifecycle, /booking\.completed/);
assert.match(lifecycle, /eventType !== 'cancelled' && eventType !== 'completed'/);
assert.match(lifecycle, /BookingRequestStatus\.CANCELLED/);
assert.match(lifecycle, /syncRequestSchedule/);
assert.match(lifecycle, /booking\.created/);
assert.match(lifecycle, /bookingTemplateValues/);
assert.match(businessController, /recordBefore/);
assert.match(businessController, /afterRecordUpsert/);
assert.match(businessController, /recordEventExists/);
assert.match(businessController, /afterRecordEventUpsert/);

assert.match(bookingController, /bookingTemplateValues/);
assert.match(bookingController, /templates\.render\(tenantId, 'booking\.created'/);
assert.match(bookingController, /templates\.render\(tenantId, 'owner\.booking\.created'/);
assert.match(bookingController, /channel: 'OWNER_IN_APP'/);
assert.match(bookingController, /OWNER_IN_APP/);

assert.match(settings, /title: 'Клиенту', count: '4'/);
assert.match(settings, /title: 'Мастеру', count: '2'/);
assert.match(settings, /Новое сообщение клиента/);
assert.match(settings, /Отдельный шаблон не нужен/);
assert.doesNotMatch(settings, /Подготовлено на будущее/);
assert.match(settings, /data-template-variable/);
assert.match(settings, /Время процедуры · 12:00-13:00/);
assert.match(settings, /Переносы строк в тексте сохраняются/);
assert.match(settings, /saveNotificationTemplate/);
assert.match(settings, /saveNotificationRouting/);

console.log('grouped notification templates regression: ok');
