import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';
import { PLATFORM_LEGAL_PACKAGE, PLATFORM_OPERATOR_IDENTITY, PLATFORM_RKN_FILING } from './platform-legal-package';

type PlatformLegalStatus = 'PRE_LAUNCH' | 'LEGAL_READY';
type TenantOperationMode = 'DEMO' | 'LIVE';
type LegalFilingStatus = 'NOT_PREPARED' | 'PREPARED' | 'SUBMITTED';
export type CommunicationPurpose = 'SERVICE' | 'DIALOG' | 'MARKETING' | 'BOOK_SYSTEM';

type PlatformStateRow = {
  id: string;
  status: PlatformLegalStatus;
  filingStatus: LegalFilingStatus;
  checklist: Record<string, boolean>;
  submittedAt: Date | null;
  submissionReference: string;
  evidenceMetadata: Record<string, unknown>;
  legalReadyAt: Date | null;
  updatedAt: Date;
};

type TenantStateRow = {
  tenantId: string;
  operationMode: TenantOperationMode;
  filingStatus: LegalFilingStatus;
  checklist: Record<string, boolean>;
  preparedAt: Date | null;
  submittedAt: Date | null;
  submissionReference: string;
  evidenceMetadata: Record<string, unknown>;
  liveAt: Date | null;
  updatedAt: Date;
};

type LegalDocumentRow = {
  id: string;
  scope: 'PLATFORM' | 'TENANT';
  tenantId: string | null;
  key: string;
  type: string;
  title: string;
  requiredForRegistration: boolean;
  requiredForLive: boolean;
  requiredForPublicBooking: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type LegalDocumentVersionRow = {
  id: string;
  documentId: string;
  version: number;
  contentSnapshot: string;
  contentHash: string;
  operatorIdentitySnapshot: Record<string, unknown>;
  publishedAt: Date;
  supersededAt: Date | null;
};

const PLATFORM_CHECKLIST_KEYS = [
  'operatorDocumentsPublished',
  'privacyPolicyPublished',
  'consentFormsPrepared',
  'saasAgreementPublished',
  'dpaPublished',
  'operatorIdentityConfigured',
  'rknFilingConfirmed',
] as const;

const TENANT_CHECKLIST_KEYS = [
  'operatorIdentityConfigured',
  'privacyPolicyPublished',
  'clientDocumentsPrepared',
  'dpaAccepted',
] as const;

const PLATFORM_REQUIRED_DOCUMENT_KEYS = ['privacy-policy', 'saas-agreement', 'dpa', 'master-pd-consent'] as const;
const TENANT_REQUIRED_LIVE_DOCUMENT_KEYS = ['privacy-policy', 'client-pd-consent', 'service-offer'] as const;

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function booleanPatch(value: unknown, allowedKeys: readonly string[]) {
  const source = objectValue(value);
  const result: Record<string, boolean> = {};
  for (const key of allowedKeys) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  return result;
}

function allTrue(checklist: Record<string, any>, keys: readonly string[]) {
  return keys.every((key) => checklist[key] === true);
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function contentHash(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

function contactPoint(channelValue: unknown, destinationValue: unknown) {
  const channel = text(channelValue).toUpperCase();
  const raw = text(destinationValue);
  if (!channel || !raw) return { type: '', value: '', subjectKey: '' };
  if (channel === 'SMS' || channel === 'WHATSAPP' || channel === 'PHONE') {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 10) digits = `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    return { type: 'PHONE', value: digits, subjectKey: digits ? `PHONE:${digits}` : '' };
  }
  if (channel === 'EMAIL') {
    const value = raw.toLowerCase();
    return { type: 'EMAIL', value, subjectKey: value ? `EMAIL:${value}` : '' };
  }
  if (channel === 'TELEGRAM') return { type: 'TELEGRAM', value: raw, subjectKey: `TELEGRAM:${raw}` };
  return { type: channel, value: raw, subjectKey: `${channel}:${raw}` };
}

@Injectable()
export class LegalRuntimeService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
  ) {}

  async onModuleInit() {
    await this.ensurePlatformLegalPackage();
  }

  private async ensurePlatformLegalPackage() {
    const state = await this.platformState();
    if (!state) return;

    for (const item of PLATFORM_LEGAL_PACKAGE) {
      await this.prisma.$executeRaw`
        INSERT INTO "LegalDocument" (
          "id", "scope", "tenantId", "key", "type", "title",
          "requiredForRegistration", "requiredForLive", "requiredForPublicBooking",
          "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, 'PLATFORM', NULL, ${item.key}, ${item.type}, ${item.title},
          ${item.requiredForRegistration}, false, false,
          true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT DO NOTHING
      `;

      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "LegalDocument"
        WHERE "scope" = 'PLATFORM' AND "tenantId" IS NULL AND "key" = ${item.key}
        LIMIT 1
      `;
      const documentId = existing[0]?.id;
      if (!documentId) continue;

      const versions = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "LegalDocumentVersion"
        WHERE "documentId" = ${documentId}
        LIMIT 1
      `;
      if (!versions[0]) {
        await this.prisma.$executeRaw`
          INSERT INTO "LegalDocumentVersion" (
            "id", "documentId", "version", "contentSnapshot", "contentHash",
            "operatorIdentitySnapshot", "publishedAt", "supersededAt"
          ) VALUES (
            ${randomUUID()}, ${documentId}, 1, ${item.content}, ${contentHash(item.content)},
            ${json(PLATFORM_OPERATOR_IDENTITY)}::jsonb,
            CURRENT_TIMESTAMP, NULL
          )
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const evidence = {
      ...objectValue(state.evidenceMetadata),
      ...PLATFORM_RKN_FILING,
    };
    const checklist = {
      ...objectValue(state.checklist),
      rknFilingConfirmed: true,
    };
    await this.prisma.$executeRaw`
      UPDATE "PlatformLegalState"
      SET "filingStatus" = 'SUBMITTED',
          "submittedAt" = COALESCE("submittedAt", CURRENT_TIMESTAMP),
          "submissionReference" = CASE
            WHEN COALESCE("submissionReference", '') = '' THEN ${PLATFORM_RKN_FILING.registrationNumber}
            ELSE "submissionReference"
          END,
          "evidenceMetadata" = ${json(evidence)}::jsonb,
          "checklist" = ${json(checklist)}::jsonb,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'platform'
    `;
    await this.promotePlatformIfReady('');
  }

  async platformState() {
    const rows = await this.prisma.$queryRaw<PlatformStateRow[]>`
      SELECT "id", "status", "filingStatus", "checklist", "submittedAt", "submissionReference",
             "evidenceMetadata", "legalReadyAt", "updatedAt"
      FROM "PlatformLegalState" WHERE "id" = 'platform' LIMIT 1
    `;
    return rows[0] || null;
  }

  async tenantState(tenantId: string) {
    const rows = await this.prisma.$queryRaw<TenantStateRow[]>`
      SELECT "tenantId", "operationMode", "filingStatus", "checklist", "preparedAt", "submittedAt",
             "submissionReference", "evidenceMetadata", "liveAt", "updatedAt"
      FROM "TenantLegalState" WHERE "tenantId" = ${tenantId} LIMIT 1
    `;
    return rows[0] || null;
  }

  async ensureTenantDemoState(tenantId: string, actorUserId = '', reason = 'tenant-created') {
    const before = await this.tenantState(tenantId);
    if (before) return before;
    await this.prisma.$executeRaw`
      INSERT INTO "TenantLegalState" ("tenantId", "operationMode", "filingStatus", "updatedAt")
      VALUES (${tenantId}, 'DEMO', 'NOT_PREPARED', CURRENT_TIMESTAMP)
      ON CONFLICT ("tenantId") DO NOTHING
    `;
    const after = await this.tenantState(tenantId);
    if (after) {
      await this.transition({
        scope: 'TENANT', tenantId, actorUserId, changeType: 'TENANT_LEGAL_STATE_CREATED',
        oldState: {}, newState: after, reason,
      });
    }
    return after;
  }

  async platformReadiness() {
    const state = await this.platformState();
    const documents = await this.listDocuments('PLATFORM', null);
    const currentDocuments = documents.filter((item) => item.currentVersion);
    const currentKeys = new Set(currentDocuments.map((item) => item.key));
    const missingDocuments = PLATFORM_REQUIRED_DOCUMENT_KEYS.filter((key) => !currentKeys.has(key));
    const storedChecklist = objectValue(state?.checklist);
    const operatorIdentityConfigured = currentDocuments.some((item) => {
      const identity = objectValue(item.currentVersion?.operatorIdentitySnapshot);
      return Boolean(text(identity.name));
    });
    const checklist = {
      ...storedChecklist,
      operatorDocumentsPublished: missingDocuments.length === 0,
      privacyPolicyPublished: currentKeys.has('privacy-policy'),
      consentFormsPrepared: currentKeys.has('master-pd-consent'),
      saasAgreementPublished: currentKeys.has('saas-agreement'),
      dpaPublished: currentKeys.has('dpa'),
      operatorIdentityConfigured,
      rknFilingConfirmed: state?.filingStatus === 'SUBMITTED',
    };
    return {
      state: state ? { ...state, checklist } : state,
      checklistKeys: PLATFORM_CHECKLIST_KEYS,
      checklistComplete: allTrue(checklist, PLATFORM_CHECKLIST_KEYS),
      missingDocuments,
      documents,
      canBecomeLegalReady: Boolean(
        state
        && state.filingStatus === 'SUBMITTED'
        && allTrue(checklist, PLATFORM_CHECKLIST_KEYS)
        && missingDocuments.length === 0
      ),
    };
  }

  async tenantReadiness(tenantId: string) {
    const state = await this.tenantState(tenantId);
    const evidence = objectValue(state?.evidenceMetadata);
    return {
      state,
      liveDecision: text(evidence.liveDecision),
      rknStatus: text(evidence.rknStatus) || (state?.filingStatus === 'SUBMITTED' ? 'SUBMITTED' : 'UNKNOWN'),
      canBecomeLive: Boolean(state && state.operationMode === 'DEMO'),
    };
  }

  async updatePlatformChecklist(actorUserId: string, patchValue: unknown) {
    const state = await this.requirePlatformState();
    if (state.status === 'LEGAL_READY') throw new ConflictException('LEGAL_READY нельзя менять через checklist; сначала верните платформу в PRE_LAUNCH');
    const merged = { ...objectValue(state.checklist), ...booleanPatch(patchValue, PLATFORM_CHECKLIST_KEYS) };
    await this.prisma.$executeRaw`
      UPDATE "PlatformLegalState"
      SET "checklist" = ${json(merged)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'platform'
    `;
    const after = await this.requirePlatformState();
    await this.transition({ scope: 'PLATFORM', actorUserId, changeType: 'PLATFORM_CHECKLIST_UPDATED', oldState: state, newState: after });
    return this.platformReadiness();
  }

  async markPlatformPrepared(actorUserId: string) {
    const readiness = await this.platformReadiness();
    const before = await this.requirePlatformState();
    if (!allTrue(objectValue(readiness.state?.checklist), PLATFORM_CHECKLIST_KEYS.filter((key) => key !== 'rknFilingConfirmed'))) {
      throw new ConflictException('Сначала завершите внутренний checklist платформы');
    }
    await this.prisma.$executeRaw`
      UPDATE "PlatformLegalState" SET "filingStatus" = 'PREPARED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'platform'
    `;
    const after = await this.requirePlatformState();
    await this.transition({ scope: 'PLATFORM', actorUserId, changeType: 'PLATFORM_FILING_PREPARED', oldState: before, newState: after });
    return this.platformReadiness();
  }

  async confirmPlatformSubmitted(actorUserId: string, input: { submissionReference?: unknown; evidenceMetadata?: unknown }) {
    const before = await this.requirePlatformState();
    if (before.filingStatus !== 'PREPARED') throw new ConflictException('Подачу можно подтвердить только после статуса PREPARED');
    const submissionReference = text(input?.submissionReference);
    if (!submissionReference) throw new BadRequestException('Зафиксируйте reference/основание подтверждения подачи');
    const evidence = objectValue(input?.evidenceMetadata);
    const checklist = { ...objectValue(before.checklist), rknFilingConfirmed: true };
    await this.prisma.$executeRaw`
      UPDATE "PlatformLegalState"
      SET "filingStatus" = 'SUBMITTED', "submittedAt" = CURRENT_TIMESTAMP,
          "submissionReference" = ${submissionReference}, "evidenceMetadata" = ${json(evidence)}::jsonb,
          "checklist" = ${json(checklist)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'platform'
    `;
    const after = await this.requirePlatformState();
    await this.transition({
      scope: 'PLATFORM', actorUserId, changeType: 'PLATFORM_FILING_SUBMITTED', oldState: before, newState: after,
      submissionReference, evidenceMetadata: evidence,
      reason: 'Book records the administrator confirmation of filing; this is not government approval.',
    });
    return this.promotePlatformIfReady(actorUserId);
  }

  private async promotePlatformIfReady(actorUserId: string) {
    const readiness = await this.platformReadiness();
    const before = readiness.state;
    if (!before || before.status === 'LEGAL_READY' || !readiness.canBecomeLegalReady) return readiness;
    await this.prisma.$executeRaw`
      UPDATE "PlatformLegalState"
      SET "status" = 'LEGAL_READY', "legalReadyAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'platform'
    `;
    const after = await this.requirePlatformState();
    await this.transition({
      scope: 'PLATFORM',
      actorUserId,
      changeType: 'PLATFORM_LEGAL_READY',
      oldState: before,
      newState: after,
      reason: 'Required platform documents are current and RKN filing is recorded.',
    });
    return this.platformReadiness();
  }

  async markPlatformLegalReady(actorUserId: string) {
    const readiness = await this.promotePlatformIfReady(actorUserId);
    if (readiness.state?.status !== 'LEGAL_READY') throw new ConflictException('Платформа не прошла обязательную юридическую готовность');
    return readiness;
  }

  async markPlatformPreLaunch(actorUserId: string, reasonValue: unknown) {
    const reason = text(reasonValue);
    if (!reason) throw new BadRequestException('Укажите причину возврата PRE_LAUNCH');
    const before = await this.requirePlatformState();
    await this.prisma.$executeRaw`
      UPDATE "PlatformLegalState" SET "status" = 'PRE_LAUNCH', "legalReadyAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'platform'
    `;
    const after = await this.requirePlatformState();
    await this.transition({ scope: 'PLATFORM', actorUserId, changeType: 'PLATFORM_PRE_LAUNCH', oldState: before, newState: after, reason });
    return this.platformReadiness();
  }

  async updateTenantChecklist(tenantId: string, actorUserId: string, patchValue: unknown) {
    const state = await this.requireTenantState(tenantId);
    if (state.operationMode === 'LIVE') throw new ConflictException('Checklist LIVE Tenant нельзя менять без возврата в DEMO');
    const merged = { ...objectValue(state.checklist), ...booleanPatch(patchValue, TENANT_CHECKLIST_KEYS) };
    await this.prisma.$executeRaw`
      UPDATE "TenantLegalState" SET "checklist" = ${json(merged)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
    `;
    const after = await this.requireTenantState(tenantId);
    await this.transition({ scope: 'TENANT', tenantId, actorUserId, changeType: 'TENANT_CHECKLIST_UPDATED', oldState: state, newState: after });
    return this.tenantReadiness(tenantId);
  }

  async markTenantPrepared(tenantId: string, actorUserId: string) {
    const readiness = await this.tenantReadiness(tenantId);
    const before = await this.requireTenantState(tenantId);
    if (before.operationMode !== 'DEMO') throw new ConflictException('Подготовка выполняется только в DEMO');
    if (!allTrue(objectValue(readiness.state?.checklist), TENANT_CHECKLIST_KEYS)) {
      throw new ConflictException('Сначала завершите юридический checklist мастера');
    }
    if ((readiness.missingLiveDocuments || []).length) {
      throw new ConflictException('Сначала опубликуйте обязательные документы мастера');
    }
    await this.prisma.$executeRaw`
      UPDATE "TenantLegalState"
      SET "filingStatus" = 'PREPARED', "preparedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
    `;
    const after = await this.requireTenantState(tenantId);
    await this.transition({ scope: 'TENANT', tenantId, actorUserId, changeType: 'TENANT_FILING_PREPARED', oldState: before, newState: after });
    return this.tenantReadiness(tenantId);
  }

  async confirmTenantSubmitted(tenantId: string, actorUserId: string, input: { submissionReference?: unknown; evidenceMetadata?: unknown }) {
    await this.assertPlatformLegalReady(actorUserId);
    await this.assertTenantActive(tenantId, actorUserId, 'TENANT_RKN_SUBMITTED');
    const readiness = await this.tenantReadiness(tenantId);
    const before = await this.requireTenantState(tenantId);
    if (before.operationMode !== 'DEMO') return readiness;
    if (before.filingStatus === 'SUBMITTED') return this.activateTenantLive(tenantId, actorUserId);
    if (!allTrue(objectValue(readiness.state?.checklist), TENANT_CHECKLIST_KEYS) || (readiness.missingLiveDocuments || []).length) {
      throw new ConflictException('Сначала должны быть готовы документы и обязательные согласия пользователя');
    }
    const submissionReference = text(input?.submissionReference);
    if (!submissionReference) throw new BadRequestException('Укажите регистрационный номер / подтверждение подачи в Роскомнадзор');
    const evidence = objectValue(input?.evidenceMetadata);
    await this.prisma.$executeRaw`
      UPDATE "TenantLegalState"
      SET "filingStatus" = 'SUBMITTED',
          "preparedAt" = COALESCE("preparedAt", CURRENT_TIMESTAMP),
          "submittedAt" = CURRENT_TIMESTAMP,
          "submissionReference" = ${submissionReference},
          "evidenceMetadata" = ${json(evidence)}::jsonb,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
    `;
    const after = await this.requireTenantState(tenantId);
    await this.transition({
      scope: 'TENANT', tenantId, actorUserId, changeType: 'TENANT_FILING_SUBMITTED', oldState: before, newState: after,
      submissionReference, evidenceMetadata: evidence,
      reason: 'Book records the user confirmation of filing; this is not government approval.',
    });
    return this.activateTenantLive(tenantId, actorUserId);
  }

  async activateTenantLive(tenantId: string, actorUserId: string, input: Record<string, unknown> = {}) {
    await this.assertPlatformLegalReady(actorUserId);
    await this.assertTenantActive(tenantId, actorUserId, 'TENANT_GO_LIVE');
    const before = await this.requireTenantState(tenantId);
    if (before.operationMode === 'LIVE') return this.tenantReadiness(tenantId);

    const source = objectValue(input);
    const decision = text(source.decision).toUpperCase();
    const allowedDecisions = new Set(['READY', 'GUIDED_SUBMITTED', 'CONTINUE_WITHOUT_CONFIRMATION']);
    if (!allowedDecisions.has(decision)) {
      throw new BadRequestException('Подтвердите выбранный путь перехода в LIVE');
    }
    if (source.responsibilityAcknowledged !== true) {
      throw new BadRequestException('Подтвердите, что решение о законности обработки данных принимаете вы');
    }

    const declaredRknStatus = text(source.rknStatus).toUpperCase();
    const rknStatus = declaredRknStatus === 'SUBMITTED'
      ? 'SUBMITTED'
      : declaredRknStatus === 'NOT_SUBMITTED'
        ? 'NOT_SUBMITTED'
        : 'UNKNOWN';
    const submissionReference = text(source.submissionReference);
    const evidenceMetadata = {
      ...objectValue(before.evidenceMetadata),
      liveDecision: decision,
      rknStatus,
      responsibilityAcknowledged: true,
      declaredAt: new Date().toISOString(),
      source: 'book-live-assistant',
    };
    const filingStatus: LegalFilingStatus = rknStatus === 'SUBMITTED' ? 'SUBMITTED' : before.filingStatus;
    const submittedAt = rknStatus === 'SUBMITTED' ? new Date() : before.submittedAt;
    const nextSubmissionReference = submissionReference || before.submissionReference;

    await this.prisma.$executeRaw`
      UPDATE "TenantLegalState"
      SET "operationMode" = 'LIVE',
          "filingStatus" = ${filingStatus},
          "submittedAt" = ${submittedAt},
          "submissionReference" = ${nextSubmissionReference},
          "evidenceMetadata" = ${json(evidenceMetadata)}::jsonb,
          "liveAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
    `;
    const after = await this.requireTenantState(tenantId);
    await this.transition({
      scope: 'TENANT',
      tenantId,
      actorUserId,
      changeType: 'TENANT_LIVE',
      oldState: before,
      newState: after,
      reason: 'User explicitly chose to enter LIVE after Book explained the personal-data responsibility boundary.',
      evidenceMetadata,
      submissionReference: nextSubmissionReference,
    });
    return this.tenantReadiness(tenantId);
  }

  async returnTenantToDemo(tenantId: string, actorUserId: string, reasonValue: unknown) {
    const reason = text(reasonValue);
    if (!reason) throw new BadRequestException('Укажите причину возврата в DEMO');
    const before = await this.requireTenantState(tenantId);
    await this.prisma.$executeRaw`
      UPDATE "TenantLegalState"
      SET "operationMode" = 'DEMO', "liveAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "tenantId" = ${tenantId}
    `;
    const after = await this.requireTenantState(tenantId);
    await this.transition({ scope: 'TENANT', tenantId, actorUserId, changeType: 'TENANT_DEMO', oldState: before, newState: after, reason });
    return this.tenantReadiness(tenantId);
  }

  async assertPlatformLegalReady(actorUserId = '') {
    const state = await this.platformState();
    if (!state || state.status !== 'LEGAL_READY') {
      await this.audit(null, actorUserId, 'POLICY_DENY', 'PLATFORM_LEGAL_READY', 'DENIED', { status: state?.status || 'MISSING' });
      throw new ForbiddenException('Платформа Book ещё не переведена в LEGAL_READY');
    }
    return state;
  }

  async assertTenantActive(tenantId: string, actorUserId = '', purpose = 'TENANT_ACCESS') {
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId }, select: { status: true } });
    if (!access || String(access.status) !== 'ACTIVE') {
      await this.audit(tenantId, actorUserId, 'POLICY_DENY', purpose, 'DENIED', { access: access?.status || 'MISSING' });
      throw new ForbiddenException('Tenant недоступен');
    }
    return access;
  }

  async assertTenantLive(tenantId: string, actorUserId = '', purpose = 'REAL_OPERATION') {
    await this.assertPlatformLegalReady(actorUserId);
    await this.assertTenantActive(tenantId, actorUserId, purpose);
    const state = await this.tenantState(tenantId);
    if (!state || state.operationMode !== 'LIVE') {
      await this.audit(tenantId, actorUserId, 'POLICY_DENY', purpose, 'DENIED', { operationMode: state?.operationMode || 'MISSING' });
      throw new ForbiddenException('Реальная операция недоступна, пока Tenant находится в DEMO');
    }
    return state;
  }

  async assertRealClientMutation(tenantId: string, actorUserId = '') {
    return this.assertTenantLive(tenantId, actorUserId, 'REAL_CLIENT_MUTATION');
  }

  async assertCanPublishBooking(tenantId: string, actorUserId = '') {
    await this.assertTenantLive(tenantId, actorUserId, 'BOOKING_PUBLICATION');
    const capability = await this.access.resolveCapability(tenantId, 'online_booking.access');
    if (capability.enabled !== true) {
      await this.audit(tenantId, actorUserId, 'POLICY_DENY', 'BOOKING_PUBLICATION', 'DENIED', { capability: capability.source });
      throw new ForbiddenException('Онлайн-запись не включена в доступе Tenant');
    }
  }

  async assertPublicBooking(tenantId: string) {
    await this.assertCanPublishBooking(tenantId, '');
    const publication = await this.prisma.bookingPublication.findUnique({ where: { tenantId }, select: { tenantId: true } });
    if (!publication) {
      await this.audit(tenantId, '', 'POLICY_DENY', 'PUBLIC_BOOKING_READ', 'DENIED', { publication: 'MISSING' });
      throw new NotFoundException('Онлайн-запись не опубликована');
    }
    return true;
  }

  async assertExternalCommunication(tenantId: string, input: {
    actorUserId?: unknown;
    purpose?: unknown;
    channel?: unknown;
    destination?: unknown;
    legalBasis?: unknown;
  }) {
    const actorUserId = text(input?.actorUserId);
    const purpose = text(input?.purpose).toUpperCase() as CommunicationPurpose;
    const channel = text(input?.channel).toUpperCase();
    const destination = text(input?.destination);
    if (!['SERVICE', 'DIALOG', 'MARKETING', 'BOOK_SYSTEM'].includes(purpose)) {
      throw new BadRequestException('Не указано назначение исходящей коммуникации');
    }
    if (purpose === 'BOOK_SYSTEM') {
      await this.audit(tenantId, actorUserId, 'POLICY_DENY', purpose, 'DENIED', { channel, reason: 'tenant-dispatch-cannot-send-book-system' });
      throw new ForbiddenException('BOOK_SYSTEM недоступен через клиентский CommunicationDispatch');
    }
    await this.assertTenantLive(tenantId, actorUserId, `COMMUNICATION_${purpose}`);
    if (!channel || !destination) throw new BadRequestException('Не определён канал или адресат');
    if (purpose === 'SERVICE' && !text(input?.legalBasis)) {
      await this.audit(tenantId, actorUserId, 'POLICY_DENY', purpose, 'DENIED', { channel, reason: 'missing-legal-basis' });
      throw new ForbiddenException('SERVICE требует явного основания workflow');
    }
    if (purpose === 'MARKETING') {
      const allowed = await this.hasCurrentMarketingConsent(tenantId, channel, destination);
      if (!allowed) {
        await this.audit(tenantId, actorUserId, 'POLICY_DENY', purpose, 'DENIED', { channel, reason: 'marketing-consent-missing-or-revoked' });
        throw new ForbiddenException('Нет действующего согласия на маркетинговую коммуникацию');
      }
    }
    await this.audit(tenantId, actorUserId, 'COMMUNICATION_POLICY', purpose, 'ALLOWED', { channel });
    return { purpose, channel };
  }

  async publishDocument(actorUserId: string, input: {
    scope?: unknown;
    tenantId?: unknown;
    key?: unknown;
    type?: unknown;
    title?: unknown;
    content?: unknown;
    operatorIdentity?: unknown;
    requiredForRegistration?: unknown;
    requiredForLive?: unknown;
    requiredForPublicBooking?: unknown;
  }) {
    const scope = text(input?.scope).toUpperCase();
    const tenantId = scope === 'TENANT' ? text(input?.tenantId) : '';
    const key = text(input?.key).toLowerCase();
    const type = text(input?.type).toUpperCase();
    const title = text(input?.title);
    const content = String(input?.content ?? '').trim();
    const operatorIdentity = objectValue(input?.operatorIdentity);
    if (!['PLATFORM', 'TENANT'].includes(scope)) throw new BadRequestException('Некорректный scope документа');
    if (scope === 'TENANT' && !tenantId) throw new BadRequestException('Для Tenant-документа нужен tenantId');
    if (!key || !type || !title || !content) throw new BadRequestException('Заполните key, type, title и content документа');
    if (!Object.keys(operatorIdentity).length) throw new BadRequestException('Нужен snapshot данных оператора');

    const result = await this.prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRaw<LegalDocumentRow[]>`
        SELECT "id", "scope", "tenantId", "key", "type", "title", "requiredForRegistration", "requiredForLive",
               "requiredForPublicBooking", "isActive", "createdAt", "updatedAt"
        FROM "LegalDocument"
        WHERE "scope" = ${scope} AND COALESCE("tenantId", '') = ${tenantId} AND "key" = ${key}
        LIMIT 1 FOR UPDATE
      `;
      let document = existingRows[0];
      if (!document) {
        const documentId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "LegalDocument" (
            "id", "scope", "tenantId", "key", "type", "title", "requiredForRegistration", "requiredForLive",
            "requiredForPublicBooking", "isActive", "createdAt", "updatedAt"
          ) VALUES (
            ${documentId}, ${scope}, ${tenantId || null}, ${key}, ${type}, ${title},
            ${input?.requiredForRegistration === true}, ${input?.requiredForLive === true},
            ${input?.requiredForPublicBooking === true}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        document = {
          id: documentId, scope: scope as 'PLATFORM' | 'TENANT', tenantId: tenantId || null, key, type, title,
          requiredForRegistration: input?.requiredForRegistration === true,
          requiredForLive: input?.requiredForLive === true,
          requiredForPublicBooking: input?.requiredForPublicBooking === true,
          isActive: true, createdAt: new Date(), updatedAt: new Date(),
        };
      } else {
        await tx.$executeRaw`
          UPDATE "LegalDocument" SET "type" = ${type}, "title" = ${title},
            "requiredForRegistration" = ${input?.requiredForRegistration === true},
            "requiredForLive" = ${input?.requiredForLive === true},
            "requiredForPublicBooking" = ${input?.requiredForPublicBooking === true},
            "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${document.id}
        `;
      }

      const versions = await tx.$queryRaw<Array<{ version: number }>>`
        SELECT "version" FROM "LegalDocumentVersion" WHERE "documentId" = ${document.id}
        ORDER BY "version" DESC LIMIT 1
      `;
      const version = Number(versions[0]?.version || 0) + 1;
      const versionId = randomUUID();
      await tx.$executeRaw`
        UPDATE "LegalDocumentVersion" SET "supersededAt" = CURRENT_TIMESTAMP
        WHERE "documentId" = ${document.id} AND "supersededAt" IS NULL
      `;
      await tx.$executeRaw`
        INSERT INTO "LegalDocumentVersion" (
          "id", "documentId", "version", "contentSnapshot", "contentHash", "operatorIdentitySnapshot", "publishedAt"
        ) VALUES (
          ${versionId}, ${document.id}, ${version}, ${content}, ${contentHash(content)},
          ${json(operatorIdentity)}::jsonb, CURRENT_TIMESTAMP
        )
      `;
      return { documentId: document.id, versionId, version };
    });

    await this.audit(tenantId || null, actorUserId, 'LEGAL_DOCUMENT_PUBLISHED', key, 'SUCCESS', { scope, type, version: result.version, documentId: result.documentId });
    return this.getDocumentVersion(result.versionId);
  }

  async listDocuments(scopeValue: unknown, tenantIdValue: unknown) {
    const scope = text(scopeValue).toUpperCase();
    const tenantId = scope === 'TENANT' ? text(tenantIdValue) : '';
    if (!['PLATFORM', 'TENANT'].includes(scope)) throw new BadRequestException('Некорректный scope');
    const documents = await this.prisma.$queryRaw<LegalDocumentRow[]>`
      SELECT "id", "scope", "tenantId", "key", "type", "title", "requiredForRegistration", "requiredForLive",
             "requiredForPublicBooking", "isActive", "createdAt", "updatedAt"
      FROM "LegalDocument"
      WHERE "scope" = ${scope} AND COALESCE("tenantId", '') = ${tenantId} AND "isActive" = true
      ORDER BY "createdAt" ASC, "key" ASC
    `;
    return Promise.all(documents.map(async (document) => {
      const current = await this.currentVersion(document.id);
      return { ...document, currentVersion: current };
    }));
  }

  async publicTenantDocuments(tenantId: string) {
    const documents = await this.listDocuments('TENANT', tenantId);
    return documents
      .filter((document) => document.requiredForPublicBooking && document.currentVersion)
      .map((document) => ({
        id: document.id,
        key: document.key,
        type: document.type,
        title: document.title,
        version: document.currentVersion!.version,
        content: document.currentVersion!.contentSnapshot,
        contentHash: document.currentVersion!.contentHash,
        operatorIdentity: document.currentVersion!.operatorIdentitySnapshot,
        publishedAt: document.currentVersion!.publishedAt,
      }));
  }

  async recordRegistrationFacts(userId: string, tenantId: string, input: {
    saasAgreementAccepted?: unknown;
    dpaAccepted?: unknown;
    privacyAcknowledged?: unknown;
    pdConsentAccepted?: unknown;
    marketingConsentAccepted?: unknown;
    source?: unknown;
    technicalEvidence?: unknown;
  }) {
    const source = text(input?.source) || 'master-registration';
    const evidence = objectValue(input?.technicalEvidence);
    const documents = await this.listDocuments('PLATFORM', null);
    const current = new Map(documents.filter((item) => item.currentVersion).map((item) => [item.key, item]));
    const required = documents.filter((item) => item.requiredForRegistration && item.currentVersion);
    const factByKey: Record<string, { accepted: boolean; action: string }> = {
      'saas-agreement': { accepted: input?.saasAgreementAccepted === true, action: 'ACCEPTED' },
      'privacy-policy': { accepted: input?.privacyAcknowledged === true, action: 'ACKNOWLEDGED' },
      'master-pd-consent': { accepted: input?.pdConsentAccepted === true, action: 'CONSENTED' },
      'marketing-consent': { accepted: input?.marketingConsentAccepted === true, action: 'CONSENTED' },
      'dpa': { accepted: input?.dpaAccepted === true, action: 'ACCEPTED' },
    };
    for (const document of required) {
      const fact = factByKey[document.key];
      if (!fact?.accepted) throw new BadRequestException(`Не зафиксирован обязательный юридический факт: ${document.key}`);
    }
    for (const [key, fact] of Object.entries(factByKey)) {
      if (!fact.accepted) continue;
      const document = current.get(key);
      if (!document?.currentVersion) continue;
      await this.prisma.$executeRaw`
        INSERT INTO "LegalAcceptanceEvent" (
          "id", "tenantId", "userId", "documentVersionId", "action", "source", "technicalEvidence", "occurredAt"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, ${userId}, ${document.currentVersion.id}, ${fact.action}, ${source},
          ${json(evidence)}::jsonb, CURRENT_TIMESTAMP
        )
      `;
    }
    return { recorded: true };
  }

  async createDataSubjectRequest(tenantId: string, actorUserId: string, input: { subjectKey?: unknown; requestType?: unknown; details?: unknown }) {
    const subjectKey = text(input?.subjectKey);
    const requestType = text(input?.requestType).toUpperCase();
    if (!subjectKey || !['EXPORT', 'CORRECTION', 'WITHDRAW_CONSENT', 'DELETE_OR_BLOCK', 'STOP_MARKETING'].includes(requestType)) {
      throw new BadRequestException('Некорректный запрос субъекта');
    }
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "DataSubjectRequest" ("id", "tenantId", "subjectKey", "requestType", "details", "createdAt", "updatedAt")
      VALUES (${id}, ${tenantId}, ${subjectKey}, ${requestType}, ${json(objectValue(input?.details))}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await this.audit(tenantId, actorUserId, 'DATA_SUBJECT_REQUEST_CREATED', requestType, 'SUCCESS', { id, subjectKey });
    return { id, tenantId, subjectKey, requestType, status: 'OPEN' };
  }

  async listDataSubjectRequests(tenantId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT "id", "tenantId", "subjectKey", "requestType", "status", "details", "result", "createdAt", "updatedAt", "resolvedAt"
      FROM "DataSubjectRequest" WHERE "tenantId" = ${tenantId} ORDER BY "createdAt" DESC
    `;
  }

  async saveRetentionPolicy(actorUserId: string, input: { scope?: unknown; tenantId?: unknown; dataType?: unknown; legalBasis?: unknown; policy?: unknown }) {
    const scope = text(input?.scope).toUpperCase();
    const tenantId = scope === 'TENANT' ? text(input?.tenantId) : '';
    const dataType = text(input?.dataType);
    const legalBasis = text(input?.legalBasis);
    const policy = objectValue(input?.policy);
    if (!['PLATFORM', 'TENANT'].includes(scope) || !dataType || !legalBasis || (scope === 'TENANT' && !tenantId)) {
      throw new BadRequestException('Некорректная retention policy');
    }
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "RetentionPolicy"
      WHERE "scope" = ${scope} AND COALESCE("tenantId", '') = ${tenantId} AND "dataType" = ${dataType} AND "legalBasis" = ${legalBasis}
      LIMIT 1
    `;
    const id = existing[0]?.id || randomUUID();
    if (existing[0]) {
      await this.prisma.$executeRaw`
        UPDATE "RetentionPolicy" SET "policy" = ${json(policy)}::jsonb, "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO "RetentionPolicy" ("id", "scope", "tenantId", "dataType", "legalBasis", "policy", "isActive", "createdAt", "updatedAt")
        VALUES (${id}, ${scope}, ${tenantId || null}, ${dataType}, ${legalBasis}, ${json(policy)}::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
    await this.audit(tenantId || null, actorUserId, 'RETENTION_POLICY_SAVED', dataType, 'SUCCESS', { scope, legalBasis });
    return { id, scope, tenantId: tenantId || null, dataType, legalBasis, policy };
  }

  async legalEvents(scopeValue: unknown, tenantIdValue: unknown) {
    const scope = text(scopeValue).toUpperCase();
    const tenantId = text(tenantIdValue);
    if (scope === 'PLATFORM') {
      return this.prisma.$queryRaw<any[]>`
        SELECT * FROM "LegalStateEvent" WHERE "scope" = 'PLATFORM' ORDER BY "occurredAt" DESC, "id" DESC
      `;
    }
    if (scope === 'TENANT' && tenantId) {
      return this.prisma.$queryRaw<any[]>`
        SELECT * FROM "LegalStateEvent" WHERE "scope" = 'TENANT' AND "tenantId" = ${tenantId}
        ORDER BY "occurredAt" DESC, "id" DESC
      `;
    }
    throw new BadRequestException('Некорректный scope событий');
  }

  async documentHistory(scopeValue: unknown, tenantIdValue: unknown) {
    const scope = text(scopeValue).toUpperCase();
    const tenantId = scope === 'TENANT' ? text(tenantIdValue) : '';
    if (!['PLATFORM', 'TENANT'].includes(scope)) throw new BadRequestException('Некорректный scope');
    return this.prisma.$queryRaw<any[]>`
      SELECT
        d."id" AS "documentId",
        d."key",
        d."type",
        d."title",
        v."id" AS "versionId",
        v."version",
        v."contentHash",
        v."publishedAt",
        v."supersededAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v ON v."documentId" = d."id"
      WHERE d."scope" = ${scope}
        AND COALESCE(d."tenantId", '') = ${tenantId}
      ORDER BY v."publishedAt" DESC, d."title" ASC, v."version" DESC
    `;
  }

  async audit(tenantId: string | null, actorUserId: string, action: string, purpose: string, result: string, metadata: unknown = {}) {
    await this.prisma.$executeRaw`
      INSERT INTO "LegalAuditEvent" ("id", "tenantId", "actorUserId", "action", "purpose", "result", "metadata", "occurredAt")
      VALUES (${randomUUID()}, ${tenantId}, ${actorUserId || null}, ${action}, ${purpose}, ${result}, ${json(objectValue(metadata))}::jsonb, CURRENT_TIMESTAMP)
    `;
  }

  private async requirePlatformState() {
    const state = await this.platformState();
    if (!state) throw new ConflictException('PlatformLegalState отсутствует: fail closed');
    return state;
  }

  private async requireTenantState(tenantId: string) {
    const state = await this.tenantState(tenantId);
    if (!state) throw new ConflictException('TenantLegalState отсутствует: fail closed');
    return state;
  }

  private async transition(input: {
    scope: 'PLATFORM' | 'TENANT';
    tenantId?: string;
    actorUserId?: string;
    changeType: string;
    oldState: unknown;
    newState: unknown;
    reason?: string;
    submissionReference?: string;
    evidenceMetadata?: unknown;
  }) {
    await this.prisma.$executeRaw`
      INSERT INTO "LegalStateEvent" (
        "id", "scope", "tenantId", "actorUserId", "changeType", "oldState", "newState", "reason",
        "submissionReference", "evidenceMetadata", "occurredAt"
      ) VALUES (
        ${randomUUID()}, ${input.scope}, ${input.tenantId || null}, ${input.actorUserId || null}, ${input.changeType},
        ${json(input.oldState)}::jsonb, ${json(input.newState)}::jsonb, ${text(input.reason)},
        ${text(input.submissionReference)}, ${json(objectValue(input.evidenceMetadata))}::jsonb, CURRENT_TIMESTAMP
      )
    `;
  }

  private async currentVersion(documentId: string) {
    const rows = await this.prisma.$queryRaw<LegalDocumentVersionRow[]>`
      SELECT "id", "documentId", "version", "contentSnapshot", "contentHash", "operatorIdentitySnapshot", "publishedAt", "supersededAt"
      FROM "LegalDocumentVersion"
      WHERE "documentId" = ${documentId} AND "supersededAt" IS NULL
      ORDER BY "version" DESC LIMIT 1
    `;
    return rows[0] || null;
  }

  private async getDocumentVersion(versionId: string) {
    const rows = await this.prisma.$queryRaw<Array<LegalDocumentVersionRow & { key: string; title: string; type: string; scope: string; tenantId: string | null }>>`
      SELECT v."id", v."documentId", v."version", v."contentSnapshot", v."contentHash", v."operatorIdentitySnapshot",
             v."publishedAt", v."supersededAt", d."key", d."title", d."type", d."scope", d."tenantId"
      FROM "LegalDocumentVersion" v JOIN "LegalDocument" d ON d."id" = v."documentId"
      WHERE v."id" = ${versionId} LIMIT 1
    `;
    return rows[0] || null;
  }

  private async hasCurrentMarketingConsent(tenantId: string, channel: string, destination: string) {
    const contact = contactPoint(channel, destination);
    if (!contact.subjectKey) return false;

    const state = await this.prisma.businessDocumentState.findUnique({
      where: { tenantId },
      select: { data: true, migrationVerifiedAt: true },
    });
    if (!state?.migrationVerifiedAt) return false;
    const data = objectValue(state.data);
    const documents = Array.isArray(data.documents) ? data.documents.map((item) => objectValue(item)) : [];
    const marketing = documents.find((item) => text(item.id) === 'messages-consent');
    if (!marketing) return false;
    const version = Math.max(1, Number(marketing.version || 1));

    const rows = await this.prisma.$queryRaw<Array<{ status: string; documentVersion: number }>>`
      SELECT "status", "documentVersion"
      FROM "ConsentEvent"
      WHERE "tenantId" = ${tenantId}
        AND "subjectType" = 'CONTACT_POINT'
        AND "subjectKey" = ${contact.subjectKey}
        AND "documentId" = 'messages-consent'
      ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC
      LIMIT 1
    `;
    const latest = rows[0];
    return Boolean(latest && latest.status === 'accepted' && Number(latest.documentVersion) === version);
  }

}
