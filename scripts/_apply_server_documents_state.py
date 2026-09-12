from pathlib import Path


def write(path, content):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:140]}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Documents owner: synchronous in-memory server state after verified migration;
# browser storage remains a legacy migration/test fallback only.
write('settings/documents/history.js', r'''const STORAGE_KEY = 'book.documents.history.v1';
let historyState = null;
let persistHistory = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || crypto.randomUUID()),
    documentId: String(item.documentId || ''),
    documentTitle: String(item.documentTitle || 'Документ'),
    documentVersion: Math.max(1, Number(item.documentVersion || 1)),
    action: String(item.action || 'updated'),
    createdAt: String(item.createdAt || new Date().toISOString()),
    source: String(item.source || 'manual'),
  };
}

function readLegacy() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalize).filter((item) => item.documentId) : [];
  } catch {
    return [];
  }
}

function read() {
  return historyState !== null ? clone(historyState) : readLegacy();
}

function writeItems(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.documentId);
  if (historyState !== null) {
    historyState = clone(normalized);
    if (typeof persistHistory === 'function') void persistHistory(clone(historyState));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return clone(normalized);
}

export function configureDocumentHistoryPersistence(handler = null) {
  persistHistory = typeof handler === 'function' ? handler : null;
}

export function readLegacyDocumentHistorySnapshot() {
  return readLegacy().map((item) => clone(item));
}

export function hydrateDocumentHistoryFromServer(items = []) {
  historyState = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.documentId);
  return getDocumentHistory();
}

export function getDocumentHistory() {
  return read().sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

export function recordDocumentHistory({ documentId, documentTitle, documentVersion = 1, action = 'updated', source = 'manual' } = {}) {
  if (!documentId) return null;
  const item = normalize({ documentId, documentTitle, documentVersion, action, source, createdAt: new Date().toISOString() });
  const items = read();
  items.push(item);
  writeItems(items);
  return item;
}
''')

write('settings/documents/consents.js', r'''const STORAGE_KEY = 'book.documents.consents.v1';
const MIGRATION_KEY = 'book.documents.consents.legacy-migrated.v1';
let consentState = null;
let persistConsents = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || crypto.randomUUID()),
    clientId: String(item.clientId || ''),
    documentId: String(item.documentId || ''),
    documentVersion: Number(item.documentVersion || 1),
    status: item.status === 'revoked' ? 'revoked' : item.status === 'declined' ? 'declined' : 'accepted',
    acceptedAt: String(item.acceptedAt || ''),
    revokedAt: String(item.revokedAt || ''),
    source: String(item.source || 'manual'),
    createdAt: String(item.createdAt || new Date().toISOString()),
  };
}

function readLegacy() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(normalize).filter((item) => item.clientId && item.documentId) : [];
  } catch {
    return [];
  }
}

function read() {
  return consentState !== null ? clone(consentState) : readLegacy();
}

function writeItems(items) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.clientId && item.documentId);
  if (consentState !== null) {
    consentState = clone(normalized);
    if (typeof persistConsents === 'function') void persistConsents(clone(consentState));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return clone(normalized);
}

export function configureConsentPersistence(handler = null) {
  persistConsents = typeof handler === 'function' ? handler : null;
}

export function readLegacyConsentSnapshot() {
  return readLegacy().map((item) => clone(item));
}

export function hydrateConsentsFromServer(items = []) {
  consentState = (Array.isArray(items) ? items : []).map(normalize).filter((item) => item.clientId && item.documentId);
  return getConsents();
}

export function migrateLegacyConsents(clients = []) {
  if (consentState === null && localStorage.getItem(MIGRATION_KEY) === '1') return;
  const existing = read();
  const keys = new Set(existing.map((item) => `${item.clientId}:${item.documentId}`));
  const next = [...existing];

  for (const client of Array.isArray(clients) ? clients : []) {
    if (client.agreements?.personalData && !keys.has(`${client.key}:pdn-consent`)) {
      next.push(normalize({ clientId: client.key, documentId: 'pdn-consent', status: 'accepted', source: 'legacy', acceptedAt: '' }));
      keys.add(`${client.key}:pdn-consent`);
    }
    if (client.agreements?.mailings && !keys.has(`${client.key}:messages-consent`)) {
      next.push(normalize({ clientId: client.key, documentId: 'messages-consent', status: 'accepted', source: 'legacy', acceptedAt: '' }));
      keys.add(`${client.key}:messages-consent`);
    }
  }

  if (next.length !== existing.length) writeItems(next);
  if (consentState === null) localStorage.setItem(MIGRATION_KEY, '1');
}

export function getConsents() {
  return read();
}

export function getClientConsents(clientId) {
  const id = String(clientId || '');
  return getConsents().filter((item) => item.clientId === id);
}

export function getLatestClientConsent(clientId, documentId) {
  const matches = getClientConsents(clientId)
    .filter((item) => item.documentId === String(documentId || ''))
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  return matches[0] || null;
}

export function recordConsent({ clientId, documentId, documentVersion = 1, status = 'accepted', source = 'manual', acceptedAt = new Date().toISOString(), revokedAt = '' } = {}) {
  const item = normalize({ clientId, documentId, documentVersion, status, source, acceptedAt, revokedAt, createdAt: new Date().toISOString() });
  const items = getConsents();
  items.push(item);
  writeItems(items);
  return item;
}
''')

write('settings/documents/data.js', r'''import { recordDocumentHistory } from './history.js';

const STORAGE_KEY = 'book.documents.templates.v1';
let documentsState = null;
let persistDocuments = null;

const DEFAULT_DOCUMENTS = [
  {
    id: 'pdn-agreement',
    system: true,
    kind: 'agreement',
    title: 'Соглашение об обработке персональных данных',
    clientConsent: false,
    required: false,
    version: 1,
    text: 'Шаблон для адаптации под вашу работу. Укажите сведения об операторе, цели и правила обработки персональных данных, категории данных, сроки хранения, порядок отзыва и контакты для обращений. Перед использованием рекомендуется проверить документ с юристом.'
  },
  {
    id: 'pdn-consent',
    system: true,
    kind: 'consent',
    title: 'Согласие на обработку персональных данных',
    clientConsent: true,
    required: true,
    version: 1,
    text: 'Я даю согласие на обработку персональных данных, необходимых для записи и оказания услуг, связи со мной и ведения истории записей. Состав данных, цели, действия с данными, срок действия согласия и способ его отзыва должны быть уточнены оператором перед использованием этого шаблона.'
  },
  {
    id: 'messages-consent',
    system: true,
    kind: 'consent',
    title: 'Согласие на информационные сообщения',
    clientConsent: true,
    required: false,
    version: 1,
    text: 'Я согласен(на) получать информационные сообщения, связанные с записью, изменением или отменой визита, а также иные сообщения, на которые я отдельно согласился(ась). Это согласие является необязательным и может быть отозвано.'
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(item = {}) {
  return {
    id: String(item.id || `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    system: Boolean(item.system),
    kind: item.kind === 'consent' ? 'consent' : 'agreement',
    title: String(item.title || 'Документ'),
    clientConsent: Boolean(item.clientConsent),
    required: Boolean(item.required),
    version: Math.max(1, Number(item.version || 1)),
    text: String(item.text || '')
  };
}

function legacySaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(saved) && saved.length ? saved.map(normalize) : null;
  } catch {
    return null;
  }
}

export function configureDocumentPersistence(handler = null) {
  persistDocuments = typeof handler === 'function' ? handler : null;
}

export function getDefaultDocuments() {
  return clone(DEFAULT_DOCUMENTS).map(normalize);
}

export function readLegacyDocumentsSnapshot() {
  const saved = legacySaved();
  return saved ? saved.map((item) => clone(item)) : null;
}

export function hydrateDocumentsFromServer(items = []) {
  documentsState = (Array.isArray(items) && items.length ? items : DEFAULT_DOCUMENTS).map(normalize);
  return getDocuments();
}

export function getDocuments() {
  if (documentsState !== null) return clone(documentsState).map(normalize);
  const saved = legacySaved();
  return saved || getDefaultDocuments();
}

export function saveDocuments(items = []) {
  const normalized = (Array.isArray(items) ? items : []).map(normalize);
  if (documentsState !== null) {
    documentsState = clone(normalized);
    if (typeof persistDocuments === 'function') void persistDocuments(clone(documentsState));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return clone(normalized);
}

export function saveDocument(document) {
  const items = getDocuments();
  const previous = items.find((item) => item.id === document?.id);
  const changedText = previous && String(previous.text || '') !== String(document?.text || '');
  const changedTitle = previous && String(previous.title || '') !== String(document?.title || '');
  const next = normalize({
    ...document,
    version: changedText ? Number(previous.version || 1) + 1 : Number(document?.version || previous?.version || 1),
  });
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) items[index] = next;
  else items.push(next);
  saveDocuments(items);

  if (!previous) {
    recordDocumentHistory({ documentId: next.id, documentTitle: next.title, documentVersion: next.version, action: 'created' });
  } else if (changedText || changedTitle) {
    recordDocumentHistory({ documentId: next.id, documentTitle: next.title, documentVersion: next.version, action: changedText ? 'version-created' : 'renamed' });
  }

  return next;
}

export function createDocument({ title = 'Новый документ', text = '' } = {}) {
  return saveDocument({
    id: `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    system: false,
    kind: 'agreement',
    title,
    clientConsent: false,
    required: false,
    version: 1,
    text
  });
}

export function resetDocumentTemplates() {
  if (documentsState !== null) return saveDocuments(getDefaultDocuments());
  localStorage.removeItem(STORAGE_KEY);
  return getDocuments();
}
''')

# Shared authenticated persistence queue gains a Documents dataset command.
replace_once(
    'core/business-persistence.js',
    "export function queueOperationalDataset(dataset, value) {\n",
    "export function queueDocumentDataset(dataset, value) {\n  const name = String(dataset || '').trim();\n  if (!name) return Promise.resolve();\n  return enqueue(`/document-state/${encodeURIComponent(name)}`, {\n    method: 'PUT',\n    body: JSON.stringify({ value }),\n  }, 'Не удалось сохранить документы на сервере');\n}\n\nexport function queueOperationalDataset(dataset, value) {\n",
)

write('document-migration.js', r'''import { apiRequest } from './core/auth.js';
import { queueDocumentDataset, setBusinessServerReady } from './core/business-persistence.js';
import { readLegacyRecordSnapshot } from './core/record/index.js';
import { readLegacyClientsSnapshot } from './main/clients/data.js';
import {
  configureConsentPersistence,
  getConsents,
  hydrateConsentsFromServer,
  migrateLegacyConsents,
  readLegacyConsentSnapshot,
} from './settings/documents/consents.js';
import {
  configureDocumentPersistence,
  getDefaultDocuments,
  hydrateDocumentsFromServer,
  readLegacyDocumentsSnapshot,
} from './settings/documents/data.js';
import {
  configureDocumentHistoryPersistence,
  hydrateDocumentHistoryFromServer,
  readLegacyDocumentHistorySnapshot,
} from './settings/documents/history.js';

configureDocumentPersistence((value) => queueDocumentDataset('documents', value));
configureConsentPersistence((value) => queueDocumentDataset('consents', value));
configureDocumentHistoryPersistence((value) => queueDocumentDataset('history', value));

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeBundle(value = {}) {
  return {
    documents: Array.isArray(value.documents) ? clone(value.documents) : [],
    consents: Array.isArray(value.consents) ? clone(value.consents) : [],
    history: Array.isArray(value.history) ? clone(value.history) : [],
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value) {
  return JSON.stringify(stable(normalizeBundle(value)));
}

function sameBundle(left, right) {
  return canonical(left) === canonical(right);
}

function populatedLegacyBrowser() {
  const clients = readLegacyClientsSnapshot();
  const record = readLegacyRecordSnapshot();
  return Boolean(clients.length || record.records.length || record.recordEvents.length);
}

function localBundle() {
  const clients = readLegacyClientsSnapshot();
  migrateLegacyConsents(clients);
  return normalizeBundle({
    documents: readLegacyDocumentsSnapshot() || getDefaultDocuments(),
    consents: readLegacyConsentSnapshot(),
    history: readLegacyDocumentHistorySnapshot(),
  });
}

async function responseJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

function hydrate(bundle) {
  const normalized = normalizeBundle(bundle?.data || bundle);
  hydrateDocumentsFromServer(normalized.documents);
  hydrateConsentsFromServer(normalized.consents);
  hydrateDocumentHistoryFromServer(normalized.history);
}

async function verifyLocal(local, remote) {
  const remoteBundle = normalizeBundle(remote?.data || remote);
  if (!sameBundle(local, remoteBundle)) throw new Error('Документы на сервере не совпадают с production-данными браузера');
  const response = await apiRequest('/document-state/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос документов');
  if (!verified?.verified || !sameBundle(local, verified?.data || verified)) {
    throw new Error('Сервер не подтвердил точность переноса документов');
  }
  return verified;
}

export async function initializeDocumentState(account = {}) {
  const local = localBundle();
  const remoteResponse = await apiRequest('/document-state');
  const remote = await responseJson(remoteResponse, 'Не удалось загрузить документы');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated) {
    if (!populatedLegacyBrowser()) return { source: 'server-awaiting-verification', verified: false };
    const verified = await verifyLocal(local, remote);
    hydrate(verified);
    return { source: 'legacy-verified', verified: true };
  }

  if (populatedLegacyBrowser()) {
    const migrateResponse = await apiRequest('/document-state/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести документы');
    if (!sameBundle(local, migrated?.data || migrated)) throw new Error('Перенос документов остановлен: серверная копия не прошла сверку');
    const verified = await verifyLocal(local, migrated);
    hydrate(verified);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) return { source: 'awaiting-populated-browser', verified: false };

  const defaults = normalizeBundle({ documents: getDefaultDocuments(), consents: getConsents(), history: [] });
  const bootstrapResponse = await apiRequest('/document-state/bootstrap', {
    method: 'POST',
    body: JSON.stringify(defaults),
  });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище документов');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище документов не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap', verified: true };
}
''')

# Initialize Documents before the owner booking bridge is allowed to run.
replace_once(
    'core.js',
    "import { initializeOperationalState } from './operational-migration.js';\n",
    "import { initializeOperationalState } from './operational-migration.js';\nimport { initializeDocumentState } from './document-migration.js';\n",
)
replace_once(
    'core.js',
    "  const operationalMigration = await initializeOperationalState(authenticatedAccount);\n  if (!operationalMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  ensureBookingBridge();\n",
    "  const operationalMigration = await initializeOperationalState(authenticatedAccount);\n  if (!operationalMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  const documentMigration = await initializeDocumentState(authenticatedAccount);\n  if (!documentMigration.verified) {\n    renderMigrationPending();\n    return;\n  }\n  ensureBookingBridge();\n",
)

# Prisma model.
replace_once(
    'server/prisma/schema.prisma',
    "  businessOperational BusinessOperationalState?\n",
    "  businessOperational BusinessOperationalState?\n  businessDocuments   BusinessDocumentState?\n",
)
write('server/prisma/migrations/20260912100000_document_state/migration.sql', r'''CREATE TABLE "BusinessDocumentState" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "migrationVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessDocumentState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessDocumentState_tenantId_key" ON "BusinessDocumentState"("tenantId");
ALTER TABLE "BusinessDocumentState" ADD CONSTRAINT "BusinessDocumentState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
''')
with Path('server/prisma/schema.prisma').open('a', encoding='utf-8') as f:
    f.write(r'''

model BusinessDocumentState {
  id                  String   @id @default(cuid())
  tenantId            String   @unique
  data                Json
  migrationVerifiedAt DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
''')

write('server/src/document-state/document-state.service.ts', r'''import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;
const DATASETS = new Set(['documents', 'consents', 'history']);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value: unknown) {
  const source = objectValue(value);
  return {
    documents: Array.isArray(source.documents) ? clone(source.documents) : [],
    consents: Array.isArray(source.consents) ? clone(source.consents) : [],
    history: Array.isArray(source.history) ? clone(source.history) : [],
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value: unknown) {
  return JSON.stringify(stable(normalize(value)));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class DocumentStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async snapshot(tenantId: string) {
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    return {
      migrated: Boolean(state),
      verified: Boolean(state?.migrationVerifiedAt),
      migrationVerifiedAt: state?.migrationVerifiedAt || null,
      data: normalize(state?.data || {}),
    };
  }

  get(tenantId: string) {
    return this.snapshot(tenantId);
  }

  async migrate(tenantId: string, body: unknown) {
    const existing = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessDocumentState.create({ data: { tenantId, data: json(normalize(body)) } });
    }
    return this.snapshot(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const current = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!current) throw new ConflictException('Документы ещё не перенесены');
    if (canonical(current.data) !== canonical(body)) throw new ConflictException('Проверка переноса документов не пройдена');
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.snapshot(tenantId);
  }

  async bootstrap(tenantId: string, body: unknown) {
    const existing = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessDocumentState.create({
        data: { tenantId, data: json(normalize(body)), migrationVerifiedAt: new Date() },
      });
    }
    return this.snapshot(tenantId);
  }

  async updateDataset(tenantId: string, dataset: string, body: unknown) {
    if (!DATASETS.has(dataset)) throw new BadRequestException('Неизвестный раздел документов');
    const state = await this.prisma.businessDocumentState.findUnique({ where: { tenantId } });
    if (!state?.migrationVerifiedAt) throw new ConflictException('Перенос документов ещё не подтверждён');
    const current = normalize(state.data);
    const source = objectValue(body);
    const value = source.value;
    current[dataset as keyof typeof current] = Array.isArray(value) ? clone(value) : [];
    await this.prisma.businessDocumentState.update({ where: { tenantId }, data: { data: json(current) } });
    return { dataset, value: current[dataset as keyof typeof current] };
  }
}
''')

write('server/src/document-state/document-state.controller.ts', r'''import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentStateService } from './document-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('document-state')
@UseGuards(JwtAuthGuard)
export class DocumentStateController {
  constructor(private readonly documents: DocumentStateService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.documents.get(request.auth!.tenantId);
  }

  @Post('migrate')
  migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.documents.migrate(request.auth!.tenantId, body);
  }

  @Post('migrate/verify')
  verify(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.documents.verifyMigration(request.auth!.tenantId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.documents.bootstrap(request.auth!.tenantId, body);
  }

  @Put(':dataset')
  updateDataset(@Req() request: AuthenticatedRequest, @Param('dataset') dataset: string, @Body() body: unknown) {
    return this.documents.updateDataset(request.auth!.tenantId, dataset, body);
  }
}
''')

write('server/src/document-state/document-state.module.ts', r'''import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocumentStateController } from './document-state.controller';
import { DocumentStateService } from './document-state.service';

@Module({
  controllers: [DocumentStateController],
  providers: [PrismaService, DocumentStateService],
  exports: [DocumentStateService],
})
export class DocumentStateModule {}
''')

replace_once(
    'server/src/app.module.ts',
    "import { BusinessStateModule } from './business-state/business-state.module';\n",
    "import { BusinessStateModule } from './business-state/business-state.module';\nimport { DocumentStateModule } from './document-state/document-state.module';\n",
)
replace_once(
    'server/src/app.module.ts',
    "  imports: [AuthModule, WorkspaceModule, ProfileModule, BusinessStateModule, OnlineBookingModule],\n",
    "  imports: [AuthModule, WorkspaceModule, ProfileModule, BusinessStateModule, DocumentStateModule, OnlineBookingModule],\n",
)

replace_once(
    'server/src/health.controller.ts',
    "      await this.prisma.$queryRaw`SELECT 1 FROM \"BusinessOperationalState\" LIMIT 1`;\n      return { status: 'ok', database: 'ok', profileStorage: 'ok', businessStorage: 'ok', operationalStorage: 'ok' };\n",
    "      await this.prisma.$queryRaw`SELECT 1 FROM \"BusinessOperationalState\" LIMIT 1`;\n      await this.prisma.$queryRaw`SELECT 1 FROM \"BusinessDocumentState\" LIMIT 1`;\n      return { status: 'ok', database: 'ok', profileStorage: 'ok', businessStorage: 'ok', operationalStorage: 'ok', documentStorage: 'ok' };\n",
)

# Guard and regression test.
write('scripts/check-document-server-ownership.mjs', r'''import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const core = read('core.js');
const migration = read('document-migration.js');
const documents = read('settings/documents/data.js');
const consents = read('settings/documents/consents.js');
const history = read('settings/documents/history.js');
const schema = read('server/prisma/schema.prisma');

if (!core.includes('initializeDocumentState')) failures.push('Core must initialize server-owned Documents before workspace render.');
if (!migration.includes("/document-state/migrate/verify")) failures.push('Documents migration must verify the server copy before switching source.');
if (!documents.includes('hydrateDocumentsFromServer') || !documents.includes('configureDocumentPersistence')) failures.push('Document templates must become server-owned after migration.');
if (!consents.includes('hydrateConsentsFromServer') || !consents.includes('configureConsentPersistence')) failures.push('Consent facts must become server-owned after migration.');
if (!history.includes('hydrateDocumentHistoryFromServer') || !history.includes('configureDocumentHistoryPersistence')) failures.push('Document history must become server-owned after migration.');
if (!schema.includes('model BusinessDocumentState')) failures.push('Server must own a dedicated Documents state.');

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('document server ownership check: OK');
''')

write('tests/document-server-owner.test.mjs', r'''import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
if (!globalThis.crypto?.randomUUID) globalThis.crypto = { randomUUID: () => `id-${Math.random()}` };

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({}) };
};

const persistence = await import('../core/business-persistence.js');
const data = await import('../settings/documents/data.js');
const consents = await import('../settings/documents/consents.js');
const history = await import('../settings/documents/history.js');
const migration = await import('../document-migration.js');
void migration;

persistence.setBusinessServerReady(true);
data.hydrateDocumentsFromServer([{ id: 'pdn-consent', system: true, kind: 'consent', title: 'PDN', clientConsent: true, required: true, version: 1, text: 'x' }]);
consents.hydrateConsentsFromServer([]);
history.hydrateDocumentHistoryFromServer([]);

data.saveDocument({ id: 'pdn-consent', system: true, kind: 'consent', title: 'PDN 2', clientConsent: true, required: true, version: 1, text: 'x' });
consents.recordConsent({ clientId: 'p1', documentId: 'pdn-consent', documentVersion: 1 });
history.recordDocumentHistory({ documentId: 'pdn-consent', documentTitle: 'PDN 2', documentVersion: 1, action: 'renamed' });
await persistence.flushBusinessPersistence();

assert.ok(calls.some((call) => call.url.endsWith('/document-state/documents') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/document-state/consents') && call.method === 'PUT'));
assert.ok(calls.some((call) => call.url.endsWith('/document-state/history') && call.method === 'PUT'));
assert.equal(JSON.parse(storage.get('book.documents.templates.v1') || 'null'), null);
console.log('document server owner tests: OK');
''')

replace_once(
    'package.json',
    'node scripts/check-operational-server-ownership.mjs',
    'node scripts/check-operational-server-ownership.mjs && node scripts/check-document-server-ownership.mjs',
)
replace_once(
    'package.json',
    'node tests/operational-server-owner.test.mjs',
    'node tests/operational-server-owner.test.mjs && node tests/document-server-owner.test.mjs',
)
