from pathlib import Path
import json


def write(path, content):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# ---------------------------------------------------------------------------
# Shared persistence queue: add operational dataset writes.
# ---------------------------------------------------------------------------
replace_once(
    'core/business-persistence.js',
    "export function queueRecordEventsDelete(recordId) {\n  const id = String(recordId || '').trim();\n  if (!id) return Promise.resolve();\n  return enqueue(`/business-state/records/${encodeURIComponent(id)}/events`, { method: 'DELETE' }, 'Не удалось удалить историю записи на сервере');\n}\n\nexport async function flushBusinessPersistence",
    "export function queueRecordEventsDelete(recordId) {\n  const id = String(recordId || '').trim();\n  if (!id) return Promise.resolve();\n  return enqueue(`/business-state/records/${encodeURIComponent(id)}/events`, { method: 'DELETE' }, 'Не удалось удалить историю записи на сервере');\n}\n\nexport function queueOperationalDataset(dataset, value) {\n  const key = String(dataset || '').trim();\n  if (!key) return Promise.resolve();\n  return enqueue(`/business-state/operational/${encodeURIComponent(key)}`, {\n    method: 'PUT',\n    body: JSON.stringify({ value }),\n  }, 'Не удалось сохранить рабочие данные на сервере');\n}\n\nexport async function flushBusinessPersistence",
)


# ---------------------------------------------------------------------------
# Day persistence: server-hydrated runtime, local legacy snapshot only before
# verified migration.
# ---------------------------------------------------------------------------
write('core/day/data.js', r'''// WorkPlan Day persistence gateway.
// Storage only: no schedule rules, time calculations, occupancy or UI decisions.
import { queueOperationalDataset } from '../business-persistence.js';

const TIMETABLE_STATE_KEY = 'book:timetable-state';
let dayRowsState = null;

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readLegacyState() {
  try {
    const value = JSON.parse(localStorage.getItem(TIMETABLE_STATE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function legacyRows() {
  const state = readLegacyState();
  return (Array.isArray(state.workingDays) ? state.workingDays : []).map((row) => clone(row));
}

export function readLegacyDaySnapshot() {
  return legacyRows();
}

export function hydrateDaysFromServer(rows = []) {
  dayRowsState = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  return dayRowsState.map((row) => clone(row));
}

export function getDayRows() {
  const rows = dayRowsState === null ? legacyRows() : dayRowsState;
  return rows.map((row) => clone(row));
}

export function replaceDayRows(rows = []) {
  const stored = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  if (dayRowsState === null) {
    localStorage.setItem(TIMETABLE_STATE_KEY, JSON.stringify({ workingDays: stored }));
  } else {
    dayRowsState = stored.map((row) => clone(row));
    void queueOperationalDataset('days', dayRowsState);
  }
  return stored.map((row) => clone(row));
}
''')
replace_once(
    'core/day/index.js',
    "// Public WorkPlan Day Core contract.\n// Manifestations import this facade; storage stays internal to the Day owner.\n",
    "// Public WorkPlan Day Core contract.\n// Manifestations import this facade; storage stays internal to the Day owner.\nexport { hydrateDaysFromServer, readLegacyDaySnapshot } from './data.js';\n",
)


# ---------------------------------------------------------------------------
# Break persistence.
# ---------------------------------------------------------------------------
write('journal/break-data.js', r'''// Persistence gateway for Break facts.
// No availability, lifecycle, UI, or workflow decisions belong here.
import { queueOperationalDataset } from '../core/business-persistence.js';

const KEY = 'book.journalBreaks';
let breakRowsState = null;

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function legacyRows() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readRows() {
  return (breakRowsState === null ? legacyRows() : breakRowsState).map((row) => clone(row));
}

function writeRows(rows) {
  const normalized = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  if (breakRowsState === null) {
    localStorage.setItem(KEY, JSON.stringify(normalized));
  } else {
    breakRowsState = normalized.map((row) => clone(row));
    void queueOperationalDataset('breaks', breakRowsState);
  }
}

export function readLegacyBreakSnapshot() {
  return legacyRows().map((row) => clone(row));
}

export function hydrateBreaksFromServer(rows = []) {
  breakRowsState = (Array.isArray(rows) ? rows : []).map((row) => clone(row));
  return readRows();
}

function normalizeId(value) {
  return String(value || '');
}

export function getBreakRows() {
  return readRows();
}

export function getBreakRow(id) {
  const breakId = normalizeId(id);
  const row = readRows().find((item) => normalizeId(item?.id) === breakId) || null;
  return clone(row);
}

export function insertBreakRow(row = null) {
  if (!row?.id || getBreakRow(row.id)) return null;
  const rows = readRows();
  const stored = clone(row);
  rows.push(stored);
  writeRows(rows);
  return clone(stored);
}

export function patchBreakRow(id, patch = {}) {
  const breakId = normalizeId(id);
  const rows = readRows();
  const index = rows.findIndex((item) => normalizeId(item?.id) === breakId);
  if (index < 0) return null;
  rows[index] = { ...rows[index], ...clone(patch) };
  writeRows(rows);
  return clone(rows[index]);
}

export function deleteBreakRow(id) {
  const breakId = normalizeId(id);
  const rows = readRows();
  const index = rows.findIndex((item) => normalizeId(item?.id) === breakId);
  if (index < 0) return null;
  const [removed] = rows.splice(index, 1);
  writeRows(rows);
  return clone(removed);
}

export function deleteBreakRowsForDay(workplaceId, date) {
  const workplace = String(workplaceId || '');
  const day = String(date || '').slice(0, 10);
  if (!workplace || !day) return [];
  const rows = readRows();
  const removed = rows.filter((item) => String(item?.workplaceId || '') === workplace
    && String(item?.date || '').slice(0, 10) === day);
  if (!removed.length) return [];
  const kept = rows.filter((item) => !removed.includes(item));
  writeRows(kept);
  return removed.map((item) => clone(item));
}
''')


# ---------------------------------------------------------------------------
# Procedures + history persistence.
# ---------------------------------------------------------------------------
write('settings/service/procedures/data.js', r'''import { queueOperationalDataset } from '../../../core/business-persistence.js';

const KEY = 'book.procedures';
const HISTORY_KEY = 'book.procedures.history';
let proceduresState = null;
let historyState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readLegacy(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function readRawProcedures() {
  const value = proceduresState === null ? readLegacy(KEY, []) : proceduresState;
  return Array.isArray(value) ? clone(value) : [];
}

function readHistory() {
  const value = historyState === null ? readLegacy(HISTORY_KEY, []) : historyState;
  return Array.isArray(value) ? clone(value) : [];
}

function writeProcedures(value) {
  const normalized = Array.isArray(value) ? clone(value) : [];
  if (proceduresState === null) localStorage.setItem(KEY, JSON.stringify(normalized));
  else {
    proceduresState = normalized;
    void queueOperationalDataset('procedures', proceduresState);
  }
}

function writeHistory(value) {
  const normalized = Array.isArray(value) ? clone(value) : [];
  if (historyState === null) localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
  else {
    historyState = normalized;
    void queueOperationalDataset('procedureHistory', historyState);
  }
}

export function readLegacyProcedureSnapshot() {
  return {
    procedures: Array.isArray(readLegacy(KEY, [])) ? clone(readLegacy(KEY, [])) : [],
    procedureHistory: Array.isArray(readLegacy(HISTORY_KEY, [])) ? clone(readLegacy(HISTORY_KEY, [])) : [],
  };
}

export function hydrateProceduresFromServer({ procedures = [], procedureHistory = [] } = {}) {
  proceduresState = Array.isArray(procedures) ? clone(procedures) : [];
  historyState = Array.isArray(procedureHistory) ? clone(procedureHistory) : [];
  return { procedures: clone(proceduresState), procedureHistory: clone(historyState) };
}

export function getProcedures() {
  return readRawProcedures().filter((item) => !item.deletedAt);
}

export function saveProcedure(item) {
  const values = readRawProcedures();
  const exists = values.some((value) => value.id === item.id);
  writeProcedures(exists ? values.map((value) => value.id === item.id ? item : value) : [...values, item]);
  return item;
}

export function pushProcedureHistory(record, action) {
  const history = readHistory();
  history.push({ ...record, historyAction: action, historyAt: new Date().toISOString() });
  writeHistory(history);
}

export function deleteProcedure(id) {
  const values = readRawProcedures();
  const found = values.find((item) => item.id === id && !item.deletedAt);
  if (!found) return false;
  pushProcedureHistory(found, 'deleted');
  writeProcedures(values.map((item) => item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item));
  return true;
}
''')


# ---------------------------------------------------------------------------
# Online-booking settings persistence.
# ---------------------------------------------------------------------------
booking_path = Path('core/booking-settings/index.js')
booking = booking_path.read_text(encoding='utf-8')
booking = "import { queueOperationalDataset } from '../business-persistence.js';\n\n" + booking
booking = booking.replace("const STORAGE_KEY = 'book.booking-settings.v1';\n", "const STORAGE_KEY = 'book.booking-settings.v1';\nlet bookingSettingsState = null;\n", 1)
old_get_save = r'''export function getBookingSettings() {
  try {
    return normalizeBookingSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return normalizeBookingSettings();
  }
}

export function saveBookingSettings(value = {}) {
  const settings = normalizeBookingSettings(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('book:booking-settings-changed', { detail: { settings } }));
  }
  return settings;
}
'''
new_get_save = r'''export function readLegacyBookingSettingsSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return null;
  try { return normalizeBookingSettings(JSON.parse(raw)); }
  catch { return null; }
}

export function hydrateBookingSettingsFromServer(value = null) {
  bookingSettingsState = value == null ? null : normalizeBookingSettings(value);
  return getBookingSettings();
}

export function getBookingSettings() {
  if (bookingSettingsState !== null) return normalizeBookingSettings(bookingSettingsState);
  try {
    return normalizeBookingSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return normalizeBookingSettings();
  }
}

export function saveBookingSettings(value = {}) {
  const settings = normalizeBookingSettings(value);
  if (bookingSettingsState === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  else {
    bookingSettingsState = settings;
    void queueOperationalDataset('bookingSettings', settings);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('book:booking-settings-changed', { detail: { settings } }));
  }
  return settings;
}
'''
if old_get_save not in booking:
    raise SystemExit('booking settings get/save block not found')
booking = booking.replace(old_get_save, new_get_save, 1)
booking_path.write_text(booking, encoding='utf-8')


# ---------------------------------------------------------------------------
# Safe one-time operational migration coordinator.
# ---------------------------------------------------------------------------
write('operational-migration.js', r'''import { apiRequest } from './core/auth.js';
import { hydrateDaysFromServer, readLegacyDaySnapshot } from './core/day/index.js';
import { hydrateBreaksFromServer, readLegacyBreakSnapshot } from './journal/break-data.js';
import { hydrateProceduresFromServer, readLegacyProcedureSnapshot } from './settings/service/procedures/data.js';
import { hydrateBookingSettingsFromServer, readLegacyBookingSettingsSnapshot } from './core/booking-settings/index.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(value = {}) {
  return {
    days: Array.isArray(value.days) ? clone(value.days) : [],
    breaks: Array.isArray(value.breaks) ? clone(value.breaks) : [],
    procedures: Array.isArray(value.procedures) ? clone(value.procedures) : [],
    procedureHistory: Array.isArray(value.procedureHistory) ? clone(value.procedureHistory) : [],
    bookingSettings: value.bookingSettings && typeof value.bookingSettings === 'object' && !Array.isArray(value.bookingSettings)
      ? clone(value.bookingSettings)
      : null,
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value) {
  return JSON.stringify(stable(normalize(value)));
}

function same(left, right) {
  return canonical(left) === canonical(right);
}

function legacyBundle() {
  const procedure = readLegacyProcedureSnapshot();
  return normalize({
    days: readLegacyDaySnapshot(),
    breaks: readLegacyBreakSnapshot(),
    procedures: procedure.procedures,
    procedureHistory: procedure.procedureHistory,
    bookingSettings: readLegacyBookingSettingsSnapshot(),
  });
}

function hasFacts(value) {
  return Boolean(value.days.length || value.breaks.length || value.procedures.length || value.procedureHistory.length || value.bookingSettings);
}

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

function hydrate(value) {
  const bundle = normalize(value);
  hydrateDaysFromServer(bundle.days);
  hydrateBreaksFromServer(bundle.breaks);
  hydrateProceduresFromServer({ procedures: bundle.procedures, procedureHistory: bundle.procedureHistory });
  hydrateBookingSettingsFromServer(bundle.bookingSettings);
}

async function verify(local, remote) {
  if (!same(local, remote)) throw new Error('График, перерывы, процедуры и настройки онлайн-записи на сервере не совпадают с данными браузера');
  const response = await apiRequest('/business-state/operational/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос Графика и онлайн-записи');
  if (!verified?.verified || !same(local, verified)) throw new Error('Сервер не подтвердил точность переноса Графика и онлайн-записи');
  return verified;
}

export async function initializeOperationalState(account = {}) {
  const local = legacyBundle();
  const localHasFacts = hasFacts(local);
  const response = await apiRequest('/business-state/operational');
  const remote = await responseJson(response, 'Не удалось загрузить График, процедуры и настройки онлайн-записи');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated) {
    if (!localHasFacts) return { source: 'server-awaiting-verification', verified: false };
    const verified = await verify(local, remote);
    hydrate(verified);
    return { source: 'legacy-verified', verified: true };
  }

  if (localHasFacts) {
    const migrateResponse = await apiRequest('/business-state/operational/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести График, процедуры и настройки онлайн-записи');
    if (!same(local, migrated)) throw new Error('Перенос Графика и онлайн-записи остановлен: серверная копия не прошла сверку');
    const verified = await verify(local, migrated);
    hydrate(verified);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) return { source: 'awaiting-populated-browser', verified: false };

  const bootstrapResponse = await apiRequest('/business-state/operational/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Графика и онлайн-записи');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Графика и онлайн-записи не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap', verified: true };
}
''')

replace_once(
    'core.js',
    "import { initializeBusinessState } from './business-migration.js';\n",
    "import { initializeBusinessState } from './business-migration.js';\nimport { initializeOperationalState } from './operational-migration.js';\n",
)
replace_once(
    'core.js',
    "  const businessMigration = await initializeBusinessState(authenticatedAccount);\n  if (!businessMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  ensureBookingBridge();\n",
    "  const businessMigration = await initializeBusinessState(authenticatedAccount);\n  if (!businessMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  const operationalMigration = await initializeOperationalState(authenticatedAccount);\n  if (!operationalMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  ensureBookingBridge();\n",
)

# Before publishing booking context, ensure Day/Break/Procedure/Settings writes
# are durably in the server source of truth.
replace_once(
    'online-booking/owner-bridge.js',
    "async function publish(force = false) {\n  const data = publicationData();\n",
    "async function publish(force = false) {\n  await flushBusinessPersistence();\n  const data = publicationData();\n",
)


# ---------------------------------------------------------------------------
# Server operational state model and API.
# ---------------------------------------------------------------------------
service_path = Path('server/src/business-state/business-state.service.ts')
service = service_path.read_text(encoding='utf-8')
service = service.replace(
    "type BusinessBundle = {\n  people: JsonObject[];\n  uei: { entities: JsonObject; relations: JsonObject; revoked: any[] };\n  records: JsonObject[];\n  recordEvents: JsonObject[];\n};\n",
    "type BusinessBundle = {\n  people: JsonObject[];\n  uei: { entities: JsonObject; relations: JsonObject; revoked: any[] };\n  records: JsonObject[];\n  recordEvents: JsonObject[];\n};\n\ntype OperationalBundle = {\n  days: JsonObject[];\n  breaks: JsonObject[];\n  procedures: JsonObject[];\n  procedureHistory: JsonObject[];\n  bookingSettings: JsonObject | null;\n};\n\nconst OPERATIONAL_DATASETS = new Set(['days', 'breaks', 'procedures', 'procedureHistory', 'bookingSettings']);\n",
    1,
)
marker = "function stable(value: any): any {\n"
helper = r'''function normalizeOperational(value: unknown): OperationalBundle {
  const source = objectValue(value);
  const bookingSettings = source.bookingSettings && typeof source.bookingSettings === 'object' && !Array.isArray(source.bookingSettings)
    ? clone(objectValue(source.bookingSettings))
    : null;
  return {
    days: (Array.isArray(source.days) ? source.days : []).map((item) => clone(objectValue(item))),
    breaks: (Array.isArray(source.breaks) ? source.breaks : []).map((item) => clone(objectValue(item))),
    procedures: (Array.isArray(source.procedures) ? source.procedures : []).map((item) => clone(objectValue(item))),
    procedureHistory: (Array.isArray(source.procedureHistory) ? source.procedureHistory : []).map((item) => clone(objectValue(item))),
    bookingSettings,
  };
}

'''
if marker not in service:
    raise SystemExit('service stable marker missing')
service = service.replace(marker, helper + marker, 1)
service = service.replace(
    "function canonical(value: BusinessBundle) {\n  return JSON.stringify(stable(value));\n}\n",
    "function canonical(value: BusinessBundle) {\n  return JSON.stringify(stable(value));\n}\n\nfunction canonicalOperational(value: OperationalBundle) {\n  return JSON.stringify(stable(value));\n}\n",
    1,
)
class_end = r'''  async upsertRecordEvent(tenantId: string, eventId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const event = clone(objectValue(source.event ?? source));
    const id = text(eventId);
    const recordId = text(event.recordId);
    if (!id || !recordId) throw new BadRequestException('У события записи отсутствует id или recordId');
    event.id = id;
    event.recordId = recordId;
    await this.prisma.businessRecordEvent.upsert({
      where: { tenantId_eventId: { tenantId, eventId: id } },
      create: { tenantId, eventId: id, recordId, position: positionValue(source.position), data: json(event) },
      update: { recordId, position: positionValue(source.position), data: json(event) },
    });
    return event;
  }
}
'''
replacement = r'''  async upsertRecordEvent(tenantId: string, eventId: string, body: unknown) {
    await this.requireVerified(tenantId);
    const source = objectValue(body);
    const event = clone(objectValue(source.event ?? source));
    const id = text(eventId);
    const recordId = text(event.recordId);
    if (!id || !recordId) throw new BadRequestException('У события записи отсутствует id или recordId');
    event.id = id;
    event.recordId = recordId;
    await this.prisma.businessRecordEvent.upsert({
      where: { tenantId_eventId: { tenantId, eventId: id } },
      create: { tenantId, eventId: id, recordId, position: positionValue(source.position), data: json(event) },
      update: { recordId, position: positionValue(source.position), data: json(event) },
    });
    return event;
  }

  private async operationalBundle(tenantId: string) {
    const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    const data = normalizeOperational(row?.data || {});
    return {
      migrated: Boolean(row),
      verified: Boolean(row?.migrationVerifiedAt),
      migrationVerifiedAt: row?.migrationVerifiedAt || null,
      ...data,
    };
  }

  getOperational(tenantId: string) {
    return this.operationalBundle(tenantId);
  }

  private async requireOperationalVerified(tenantId: string) {
    const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    if (!row?.migrationVerifiedAt) throw new ConflictException('Перенос Графика, процедур и онлайн-записи ещё не подтверждён');
    return row;
  }

  async migrateOperational(tenantId: string, body: unknown) {
    const expected = normalizeOperational(body);
    const existing = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessOperationalState.create({ data: { tenantId, data: json(expected) } });
    }
    return this.operationalBundle(tenantId);
  }

  async verifyOperationalMigration(tenantId: string, body: unknown) {
    const expected = normalizeOperational(body);
    const current = await this.operationalBundle(tenantId);
    if (!current.migrated) throw new ConflictException('График, процедуры и онлайн-запись ещё не перенесены');
    const actual = normalizeOperational(current);
    if (canonicalOperational(actual) !== canonicalOperational(expected)) {
      throw new ConflictException('Проверка переноса Графика, процедур и онлайн-записи не пройдена');
    }
    await this.prisma.businessOperationalState.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.operationalBundle(tenantId);
  }

  async bootstrapOperational(tenantId: string) {
    const existing = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessOperationalState.create({
        data: { tenantId, data: json(normalizeOperational({})), migrationVerifiedAt: new Date() },
      });
    }
    return this.operationalBundle(tenantId);
  }

  async updateOperationalDataset(tenantId: string, dataset: string, body: unknown) {
    const key = text(dataset);
    if (!OPERATIONAL_DATASETS.has(key)) throw new BadRequestException('Неизвестный набор рабочих данных');
    const row = await this.requireOperationalVerified(tenantId);
    const current = normalizeOperational(row.data);
    const source = objectValue(body);
    const value = source.value;
    if (key === 'bookingSettings') current.bookingSettings = value && typeof value === 'object' && !Array.isArray(value) ? clone(objectValue(value)) : null;
    else (current as any)[key] = Array.isArray(value) ? clone(value) : [];
    await this.prisma.businessOperationalState.update({ where: { tenantId }, data: { data: json(current) } });
    return current;
  }
}
'''
if class_end not in service:
    raise SystemExit('service class end marker missing')
service = service.replace(class_end, replacement, 1)
service_path.write_text(service, encoding='utf-8')

controller_path = Path('server/src/business-state/business-state.controller.ts')
controller = controller_path.read_text(encoding='utf-8')
end = r'''  @Put('record-events/:eventId')
  upsertRecordEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    return this.businessState.upsertRecordEvent(request.auth!.tenantId, eventId, body);
  }
}
'''
new_end = r'''  @Put('record-events/:eventId')
  upsertRecordEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    return this.businessState.upsertRecordEvent(request.auth!.tenantId, eventId, body);
  }

  @Get('operational')
  operational(@Req() request: AuthenticatedRequest) {
    return this.businessState.getOperational(request.auth!.tenantId);
  }

  @Post('operational/migrate')
  migrateOperational(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.migrateOperational(request.auth!.tenantId, body);
  }

  @Post('operational/migrate/verify')
  verifyOperational(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.verifyOperationalMigration(request.auth!.tenantId, body);
  }

  @Post('operational/bootstrap')
  bootstrapOperational(@Req() request: AuthenticatedRequest) {
    return this.businessState.bootstrapOperational(request.auth!.tenantId);
  }

  @Put('operational/:dataset')
  updateOperational(@Req() request: AuthenticatedRequest, @Param('dataset') dataset: string, @Body() body: unknown) {
    return this.businessState.updateOperationalDataset(request.auth!.tenantId, dataset, body);
  }
}
'''
if end not in controller:
    raise SystemExit('controller end marker missing')
controller_path.write_text(controller.replace(end, new_end, 1), encoding='utf-8')


# Prisma model + migration.
schema_path = Path('server/prisma/schema.prisma')
schema = schema_path.read_text(encoding='utf-8')
schema = schema.replace(
    "  businessRecordEvents BusinessRecordEvent[]\n",
    "  businessRecordEvents BusinessRecordEvent[]\n  businessOperationalState BusinessOperationalState?\n",
    1,
)
schema += r'''

model BusinessOperationalState {
  id                  String   @id @default(cuid())
  tenantId            String   @unique
  data                Json
  migrationVerifiedAt DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
'''
schema_path.write_text(schema, encoding='utf-8')

write('server/prisma/migrations/20260912090000_operational_state/migration.sql', r'''CREATE TABLE "BusinessOperationalState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "migrationVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessOperationalState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessOperationalState_tenantId_key" ON "BusinessOperationalState"("tenantId");

ALTER TABLE "BusinessOperationalState" ADD CONSTRAINT "BusinessOperationalState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
''')

replace_once(
    'server/src/health.controller.ts',
    '      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessStateMeta" LIMIT 1`;\n      return { status: \'ok\', database: \'ok\', profileStorage: \'ok\', businessStorage: \'ok\' };\n',
    '      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessStateMeta" LIMIT 1`;\n      await this.prisma.$queryRaw`SELECT 1 FROM "BusinessOperationalState" LIMIT 1`;\n      return { status: \'ok\', database: \'ok\', profileStorage: \'ok\', businessStorage: \'ok\', operationalStorage: \'ok\' };\n',
)


# ---------------------------------------------------------------------------
# Regression and architecture guard.
# ---------------------------------------------------------------------------
write('tests/operational-server-owner.test.mjs', r'''import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.sessionStorage = { getItem: () => 'test-token', setItem: () => {}, removeItem: () => {} };
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

localStorage.setItem('book:timetable-state', JSON.stringify({ workingDays: [{ date: '2026-09-01', workplaceId: 'legacy', from: '09:00', to: '10:00' }] }));
localStorage.setItem('book.journalBreaks', JSON.stringify([{ id: 'legacy-break', workplaceId: 'legacy', date: '2026-09-01', from: '09:30', to: '09:45' }]));
localStorage.setItem('book.procedures', JSON.stringify([{ id: 'legacy-procedure', name: 'Legacy' }]));
localStorage.setItem('book.procedures.history', JSON.stringify([]));
localStorage.setItem('book.booking-settings.v1', JSON.stringify({ welcomeTitle: 'Legacy', slotStep: 10 }));

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({}) };
};

const persistence = await import('../core/business-persistence.js');
const day = await import('../core/day/index.js');
const breaks = await import('../journal/break-data.js');
const procedures = await import('../settings/service/procedures/data.js');
const booking = await import('../core/booking-settings/index.js');

const legacyDaysRaw = localStorage.getItem('book:timetable-state');
const legacyBreaksRaw = localStorage.getItem('book.journalBreaks');
const legacyProceduresRaw = localStorage.getItem('book.procedures');
const legacyBookingRaw = localStorage.getItem('book.booking-settings.v1');

persistence.setBusinessServerReady(true);
day.hydrateDaysFromServer([{ date: '2026-10-01', workplaceId: 'server', from: '10:00', to: '18:00' }]);
breaks.hydrateBreaksFromServer([{ id: 'server-break', workplaceId: 'server', date: '2026-10-01', from: '13:00', to: '13:30' }]);
procedures.hydrateProceduresFromServer({ procedures: [{ id: 'server-procedure', name: 'Стрижка' }], procedureHistory: [] });
booking.hydrateBookingSettingsFromServer({ welcomeTitle: 'Server', welcomeText: 'Text', slotStep: 15, theme: {} });

assert.equal(day.getDays()[0].workplaceId, 'server');
assert.equal(breaks.getBreakRows()[0].id, 'server-break');
assert.equal(procedures.getProcedures()[0].id, 'server-procedure');
assert.equal(booking.getBookingSettings().welcomeTitle, 'Server');

day.saveDays([{ date: '2026-10-02', workplaceId: 'server', from: '11:00', to: '18:00' }]);
breaks.insertBreakRow({ id: 'server-break-2', workplaceId: 'server', date: '2026-10-02', from: '14:00', to: '14:30' });
procedures.saveProcedure({ id: 'server-procedure-2', name: 'Окрашивание' });
booking.saveBookingSettings({ welcomeTitle: 'Updated', welcomeText: 'Text', slotStep: 10, theme: {} });
await persistence.flushBusinessPersistence({ timeoutMs: 2000 });

assert.equal(localStorage.getItem('book:timetable-state'), legacyDaysRaw);
assert.equal(localStorage.getItem('book.journalBreaks'), legacyBreaksRaw);
assert.equal(localStorage.getItem('book.procedures'), legacyProceduresRaw);
assert.equal(localStorage.getItem('book.booking-settings.v1'), legacyBookingRaw);
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/days') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/breaks') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/procedures') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/business-state/operational/bookingSettings') && call.method === 'PUT'));

console.log('operational server owner tests: OK');
''')

write('scripts/check-operational-server-ownership.mjs', r'''import fs from 'node:fs';

function read(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }
const failures = [];
const core = read('core.js');
const day = read('core/day/data.js');
const breaks = read('journal/break-data.js');
const procedures = read('settings/service/procedures/data.js');
const booking = read('core/booking-settings/index.js');
const bridge = read('online-booking/owner-bridge.js');
const server = read('server/src/business-state/business-state.service.ts');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('await initializeOperationalState(authenticatedAccount)')) failures.push('Book must hydrate operational booking facts before rendering.');
if (!day.includes('hydrateDaysFromServer') || !day.includes("queueOperationalDataset('days'")) failures.push('Day must become server-owned after migration.');
if (!breaks.includes('hydrateBreaksFromServer') || !breaks.includes("queueOperationalDataset('breaks'")) failures.push('Break must become server-owned after migration.');
if (!procedures.includes('hydrateProceduresFromServer') || !procedures.includes("queueOperationalDataset('procedures'")) failures.push('Procedures must become server-owned after migration.');
if (!booking.includes('hydrateBookingSettingsFromServer') || !booking.includes("queueOperationalDataset('bookingSettings'")) failures.push('Booking settings must become server-owned after migration.');
if (!bridge.includes('async function publish(force = false) {\n  await flushBusinessPersistence();')) failures.push('Online publication must flush operational facts before publishing context.');
if (!server.includes('businessOperationalState') || !server.includes('verifyOperationalMigration')) failures.push('Server must own verified operational migration.');
if (!schema.includes('model BusinessOperationalState')) failures.push('Prisma must define BusinessOperationalState.');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('operational server ownership check: OK');
''')

package_path = Path('package.json')
package_data = json.loads(package_path.read_text(encoding='utf-8'))
if 'check-operational-server-ownership.mjs' not in package_data['scripts']['check']:
    package_data['scripts']['check'] += ' && node scripts/check-operational-server-ownership.mjs'
if 'operational-server-owner.test.mjs' not in package_data['scripts']['test']:
    package_data['scripts']['test'] += ' && node tests/operational-server-owner.test.mjs'
package_path.write_text(json.dumps(package_data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
