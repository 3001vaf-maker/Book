import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma.service';
import { TenantDocumentArchiveService } from '../tenant-document-archive/tenant-document-archive.service';

const SCENARIO_KEY = 'first-run';
const DEMO_DAYS = 14;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + Math.max(0, days) * 24 * 60 * 60 * 1000);
}

@Injectable()
export class FirstRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentArchive: TenantDocumentArchiveService,
  ) {}

  private async publishedVersion() {
    const scenario = await this.prisma.firstRunScenario.findUnique({ where: { key: SCENARIO_KEY } });
    if (!scenario || !scenario.isActive) throw new NotFoundException('Сценарий первого знакомства не опубликован');
    const version = await this.prisma.firstRunScenarioVersion.findFirst({
      where: { scenarioId: scenario.id, status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }],
      include: { steps: { where: { isActive: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!version) throw new NotFoundException('Сценарий первого знакомства не опубликован');
    return version;
  }

  private async rknGuideSnapshot(tenantId: string, platformAccountId: string) {
    const [profile, operational] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
        include: { workplaces: { orderBy: { position: 'asc' } } },
      }),
      this.prisma.businessOperationalState.findUnique({ where: { tenantId } }),
    ]);
    if (!profile) throw new NotFoundException('Профиль ещё не заполнен');

    const operationalData = objectValue(operational?.data);
    const procedures = arrayValue(operationalData.procedures)
      .filter((item) => item && typeof item === 'object' && !item.deletedAt)
      .map((item) => text(item.name))
      .filter(Boolean);
    const phones = arrayValue(profile.phones).map(text).filter(Boolean);
    const emails = arrayValue(profile.emails).map(text).filter(Boolean);
    const workplaces = profile.workplaces.map((workplace) => ({
      name: text(workplace.name),
      city: text(workplace.city),
      address: text(workplace.address),
    }));

    return {
      fullName: [profile.name, profile.surname].map(text).filter(Boolean).join(' ') || 'Не указано',
      profession: text(profile.profession),
      phone: phones[0] || '',
      email: emails[0] || '',
      workplaces,
      procedures,
    };
  }

  private renderRknGuidePdf(snapshotValue: unknown, generatedAtValue: unknown) {
    const snapshot = objectValue(snapshotValue);
    const workplaces = arrayValue(snapshot.workplaces).map((value) => objectValue(value));
    const procedures = arrayValue(snapshot.procedures).map(text).filter(Boolean);
    const workplaceLines = workplaces.map((workplace, index) => {
      const parts = [text(workplace.name), text(workplace.city), text(workplace.address)].filter(Boolean);
      return `${index + 1}. ${parts.join(' · ') || 'Рабочее пространство'}`;
    });
    const generatedAt = new Date(String(generatedAtValue || ''));
    const generatedMoment = Number.isFinite(generatedAt.getTime()) ? generatedAt : new Date();

    const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 48, left: 52, right: 52 } });
    doc.font('/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf');
    const chunks: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const heading = (value: string) => {
      doc.moveDown(0.7).fontSize(14).text(value, { underline: false }).moveDown(0.3);
      doc.fontSize(10.5);
    };
    const item = (value: string) => doc.text(`• ${value}`, { indent: 8, paragraphGap: 3 });

    doc.info.Title = 'Подготовка к уведомлению об обработке персональных данных';
    doc.fontSize(18).text('Подготовка к уведомлению об обработке персональных данных');
    doc.moveDown(0.5).fontSize(9.5).fillColor('#555555')
      .text('Персональный рабочий лист. Он помогает подготовить сведения для официальной формы Роскомнадзора, но не является юридическим заключением и не подтверждает факт подачи уведомления.');
    doc.fillColor('#000000');

    heading('1. Данные профиля, которые уже есть в системе');
    item(`Пользователь: ${text(snapshot.fullName) || 'Не указано'}`);
    item(`Вид деятельности: ${text(snapshot.profession) || 'не указан'}`);
    item(`Контактный телефон: ${text(snapshot.phone) || 'не указан'}`);
    item(`Электронная почта: ${text(snapshot.email) || 'не указана'}`);
    if (workplaceLines.length) {
      doc.text('Рабочие пространства:');
      workplaceLines.forEach((value) => item(value));
    } else {
      item('Рабочее пространство: не указано');
    }

    heading('2. Настроенная деятельность');
    if (procedures.length) {
      doc.text('Добавленные услуги:');
      procedures.slice(0, 30).forEach((value) => item(value));
      if (procedures.length > 30) item(`И ещё: ${procedures.length - 30}`);
    } else {
      item('Услуги ещё не добавлены');
    }

    heading('3. Что подготовить перед заполнением официальной формы');
    [
      'Сведения об операторе персональных данных и актуальные контактные данные.',
      'Фактические цели обработки персональных данных в вашей деятельности.',
      'Категории людей, чьи данные вы действительно будете обрабатывать.',
      'Категории и конкретный состав персональных данных, которые действительно необходимы для этих целей.',
      'Перечень операций с данными и способы обработки, которые используются фактически.',
      'Сведения о хранении, защите и месте нахождения базы данных.',
      'Дату начала обработки и условия прекращения обработки.',
      'Сведения об ответственных лицах и мерах защиты — в объёме, который требует актуальная официальная форма.',
    ].forEach(item);

    heading('4. Важное для работы с системой');
    [
      'Не переносите в рабочую среду реальные персональные данные других людей до того, как определены законные основания их обработки.',
      'Рекламные и маркетинговые сообщения требуют отдельного предварительного согласия адресата; это согласие не заменяется обычным согласием на обработку персональных данных.',
      'В учебном сценарии используйте только вымышленные данные.',
      'После подачи уведомления сохраняйте у себя подтверждение и актуализируйте сведения при изменении фактической обработки.',
    ].forEach(item);

    heading('5. Официальный сервис');
    doc.fillColor('#1f4f8a').text('https://pd.rkn.gov.ru/operators-registry/notification/', {
      link: 'https://pd.rkn.gov.ru/operators-registry/notification/',
      underline: true,
    });
    doc.fillColor('#000000').moveDown(0.4)
      .text('Перед отправкой сверяйте поля и формулировки с актуальной официальной формой и своей фактической деятельностью.');

    heading('6. Что система намеренно не подставляет');
    [
      'паспортные данные;',
      'ИНН и ОГРНИП;',
      'юридический адрес;',
      'реальные персональные данные других людей.',
    ].forEach(item);

    doc.moveDown(1).fontSize(8.5).fillColor('#666666')
      .text(`Сформировано: ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(generatedMoment)}`);
    doc.end();
    return result;
  }

  async rknGuide(tenantId: string, platformAccountId: string, documentId = '') {
    const stored = documentId
      ? await this.documentArchive.rknGuideDocument(tenantId, documentId)
      : await this.documentArchive.saveRknGuide(
        tenantId,
        await this.rknGuideSnapshot(tenantId, platformAccountId),
      );
    const attachment = objectValue((stored as JsonObject).attachment);
    return {
      pdf: await this.renderRknGuidePdf(attachment.snapshot, attachment.generatedAt),
      documentId: text((stored as JsonObject).id),
      fileName: text(attachment.fileName) || 'rkn-guide.pdf',
    };
  }

  async registrationDocuments() {
    const rows = await this.prisma.$queryRaw<Array<{
      documentId: string;
      documentVersionId: string;
      key: string;
      type: string;
      title: string;
      requiredForRegistration: boolean;
      version: number;
      contentSnapshot: string;
      publishedAt: Date;
    }>>`
      SELECT
        d."id" AS "documentId",
        v."id" AS "documentVersionId",
        d."key",
        d."type",
        d."title",
        d."requiredForRegistration",
        v."version",
        v."contentSnapshot",
        v."publishedAt"
      FROM "PlatformDocument" d
      JOIN LATERAL (
        SELECT *
        FROM "PlatformDocumentVersion"
        WHERE "documentId" = d."id"
        ORDER BY "version" DESC, "publishedAt" DESC
        LIMIT 1
      ) v ON true
      WHERE d."isActive" = true
        AND (d."requiredForRegistration" = true OR d."key" = 'marketing-consent')
      ORDER BY d."requiredForRegistration" DESC, d."createdAt" ASC, d."key" ASC
    `;

    const requiredCount = rows.filter((row) => row.requiredForRegistration).length;
    if (!requiredCount) {
      throw new ConflictException('Обязательные регистрационные документы Реестра не подготовлены');
    }

    return rows.map((row) => ({
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      key: row.key,
      type: row.type,
      title: row.title,
      required: Boolean(row.requiredForRegistration),
      optionalMarketing: row.key === 'marketing-consent',
      version: row.version,
      content: row.contentSnapshot,
      publishedAt: row.publishedAt.toISOString(),
    }));
  }

  async validateRegistrationDocuments(factsValue: unknown) {
    const documents = await this.registrationDocuments();
    const facts = arrayValue(factsValue).map((value) => objectValue(value));
    const byKey = new Map(facts.map((fact) => [text(fact.key), fact]));

    for (const document of documents.filter((item) => item.required)) {
      const fact = byKey.get(document.key);
      if (!fact || fact.accepted !== true || Number(fact.version || 0) !== document.version) {
        throw new BadRequestException(`Необходимо подтвердить документ «${document.title}» актуальной версии`);
      }
    }

    return documents.map((document) => {
      const fact = byKey.get(document.key);
      const accepted = fact?.accepted === true && Number(fact?.version || 0) === document.version;
      return {
        ...document,
        accepted,
        action: document.optionalMarketing
          ? (accepted ? 'CONSENTED' : 'DECLINED')
          : document.type.includes('CONSENT')
            ? 'CONSENTED'
            : document.type.includes('POLICY')
              ? 'ACKNOWLEDGED'
              : 'ACCEPTED',
      };
    });
  }

  async activateInvitation(invitationId: string, tenantId: string) {
    const invitation = await this.prisma.tenantInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.tenantId !== tenantId) throw new NotFoundException('Приглашение не найдено');

    if (invitation.activatedAt && invitation.firstRunScenarioVersionId && invitation.demoExpiresAt) {
      return {
        activatedAt: invitation.activatedAt,
        demoExpiresAt: invitation.demoExpiresAt,
        scenarioVersionId: invitation.firstRunScenarioVersionId,
      };
    }

    const version = await this.publishedVersion();
    const now = new Date();
    const demoExpiresAt = addDays(now, DEMO_DAYS);
    const invitationExpiresAt = invitation.expiresAt.getTime() < demoExpiresAt.getTime()
      ? demoExpiresAt
      : invitation.expiresAt;

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: {
          activatedAt: now,
          demoExpiresAt,
          firstRunScenarioVersionId: version.id,
          expiresAt: invitationExpiresAt,
        },
      });
      await tx.tenantAccess.update({
        where: { tenantId },
        data: {
          demoActivatedAt: now,
          demoExpiresAt,
        },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'INVITATION_ACTIVATED',
          scenarioVersionId: version.id,
          metadata: json({ invitationId: invitation.id, demoDays: DEMO_DAYS }),
          occurredAt: now,
        },
      });
    });

    return { activatedAt: now, demoExpiresAt, scenarioVersionId: version.id };
  }

  async assignFromInvitation(invitationId: string, tenantId: string, platformAccountId: string) {
    let invitation = await this.prisma.tenantInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.tenantId !== tenantId) throw new NotFoundException('Приглашение не найдено');
    if (!invitation.firstRunScenarioVersionId || !invitation.activatedAt || !invitation.demoExpiresAt) {
      await this.activateInvitation(invitationId, tenantId);
      invitation = await this.prisma.tenantInvitation.findUnique({ where: { id: invitationId } });
    }
    if (!invitation?.firstRunScenarioVersionId) throw new ConflictException('Версия сценария не зафиксирована');

    const version = await this.prisma.firstRunScenarioVersion.findUnique({
      where: { id: invitation.firstRunScenarioVersionId },
      include: { steps: { where: { isActive: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!version) throw new NotFoundException('Версия сценария не найдена');
    const firstStep = version.steps[0]?.key || '';

    const existing = await this.prisma.firstRunProgress.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
    });
    if (!existing) {
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.firstRunProgress.create({
          data: {
            tenantId,
            platformAccountId,
            scenarioVersionId: version.id,
            currentStepKey: firstStep,
            startedAt: now,
          },
        });
        await tx.platformActivityEvent.createMany({
          data: [
            {
              tenantId,
              platformAccountId,
              eventType: 'ACCOUNT_CREATED',
              scenarioVersionId: version.id,
              metadata: json({ invitationId }),
              occurredAt: now,
            },
            {
              tenantId,
              platformAccountId,
              eventType: 'FIRST_RUN_STARTED',
              stepKey: firstStep,
              scenarioVersionId: version.id,
              metadata: json({ scenarioVersion: version.version }),
              occurredAt: now,
            },
          ],
        });
      });
    }
    return this.state(tenantId, platformAccountId);
  }

  private async progress(tenantId: string, platformAccountId: string) {
    return this.prisma.firstRunProgress.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      include: {
        scenarioVersion: {
          include: {
            steps: {
              where: { isActive: true },
              orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        steps: true,
      },
    });
  }

  async state(tenantId: string, platformAccountId: string) {
    const [access, progress] = await Promise.all([
      this.prisma.tenantAccess.findUnique({ where: { tenantId } }),
      this.progress(tenantId, platformAccountId),
    ]);
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');

    const now = Date.now();
    const demoExpiresAt = access.demoExpiresAt?.toISOString() || '';
    const demoExpired = Boolean(
      access.commercialMode === 'DEMO'
      && access.demoExpiresAt
      && access.demoExpiresAt.getTime() <= now,
    );

    if (!progress) {
      return {
        assigned: false,
        commercialMode: access.commercialMode,
        demo: {
          activatedAt: access.demoActivatedAt?.toISOString() || '',
          expiresAt: demoExpiresAt,
          expired: demoExpired,
        },
      };
    }

    const byStep = new Map(progress.steps.map((item) => [item.stepId, item]));
    const steps = progress.scenarioVersion.steps.map((step) => {
      const stepProgress = byStep.get(step.id);
      return {
        id: step.id,
        key: step.key,
        position: step.position,
        kind: step.kind,
        title: step.title,
        modalTitle: step.modalTitle,
        modalBody: step.modalBody,
        primaryLabel: step.primaryLabel,
        skipLabel: step.skipLabel,
        route: step.route,
        target: step.target,
        completionKey: step.completionKey,
        metadata: step.metadata,
        status: stepProgress?.status || 'NOT_STARTED',
        modalSeenAt: stepProgress?.modalSeenAt?.toISOString() || '',
        startedAt: stepProgress?.startedAt?.toISOString() || '',
        completedAt: stepProgress?.completedAt?.toISOString() || '',
        skippedAt: stepProgress?.skippedAt?.toISOString() || '',
        lastSeenAt: stepProgress?.lastSeenAt?.toISOString() || '',
      };
    });

    return {
      assigned: true,
      commercialMode: access.commercialMode,
      demo: {
        activatedAt: access.demoActivatedAt?.toISOString() || '',
        expiresAt: demoExpiresAt,
        expired: demoExpired,
      },
      scenario: {
        id: progress.scenarioVersion.id,
        version: progress.scenarioVersion.version,
        status: progress.scenarioVersion.status,
      },
      progress: {
        status: progress.status,
        currentStepKey: progress.currentStepKey,
        startedAt: progress.startedAt.toISOString(),
        completedAt: progress.completedAt?.toISOString() || '',
      },
      steps,
    };
  }

  private async currentStep(tenantId: string, platformAccountId: string, stepKey: string) {
    const progress = await this.progress(tenantId, platformAccountId);
    if (!progress) throw new NotFoundException('Сценарий пользователю не назначен');
    const step = progress.scenarioVersion.steps.find((item) => item.key === stepKey);
    if (!step) throw new NotFoundException('Этап не найден');
    if (progress.status !== 'IN_PROGRESS') throw new ConflictException('Сценарий уже завершён');
    if (progress.currentStepKey !== step.key) throw new ConflictException('Сначала завершите текущий этап');
    return { progress, step };
  }

  async markModalSeen(tenantId: string, platformAccountId: string, stepKey: string, sessionId = '') {
    const { progress, step } = await this.currentStep(tenantId, platformAccountId, stepKey);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.firstRunStepProgress.upsert({
        where: { progressId_stepId: { progressId: progress.id, stepId: step.id } },
        create: {
          progressId: progress.id,
          stepId: step.id,
          status: 'ACTIVE',
          modalSeenAt: now,
          startedAt: now,
          lastSeenAt: now,
        },
        update: {
          status: 'ACTIVE',
          modalSeenAt: now,
          lastSeenAt: now,
        },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          platformAccountId,
          sessionId: sessionId || null,
          eventType: 'STEP_MODAL_SHOWN',
          stepKey: step.key,
          scenarioVersionId: progress.scenarioVersionId,
          metadata: json({ title: step.title }),
          occurredAt: now,
        },
      });
    });
    return this.state(tenantId, platformAccountId);
  }

  private async requiredActionReady(tenantId: string, platformAccountId: string, completionKey: string) {
    if (completionKey === 'profile.ready') {
      const profile = await this.prisma.profile.findUnique({
        where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
        include: { workplaces: true },
      });
      const phones = arrayValue(profile?.phones);
      return Boolean(
        profile
        && text(profile.name)
        && phones.some((value) => text(value))
        && text(profile.profession)
        && profile.workplaces.length > 0,
      );
    }

    if (completionKey === 'procedures.ready') {
      const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
      return arrayValue(objectValue(row?.data).procedures).length > 0;
    }

    if (completionKey === 'people.demo-created') {
      return (await this.prisma.person.count({ where: { tenantId } })) > 0;
    }

    if (completionKey === 'timetable.day-created') {
      const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
      return arrayValue(objectValue(row?.data).days).length > 0;
    }

    if (completionKey === 'record.demo-created') {
      return (await this.prisma.record.count({ where: { tenantId } })) > 0;
    }

    if (completionKey === 'payment.demo-completed') {
      return (await this.prisma.financeOperation.count({
        where: { tenantId, kind: 'payment', status: 'completed' },
      })) > 0;
    }

    return true;
  }

  async completeStep(
    tenantId: string,
    platformAccountId: string,
    stepKey: string,
    actionValue: unknown,
    sessionId = '',
  ) {
    const action = text(actionValue).toLowerCase() === 'skip' ? 'skip' : 'complete';
    const { progress, step } = await this.currentStep(tenantId, platformAccountId, stepKey);
    const existingStep = progress.steps.find((item) => item.stepId === step.id) || null;

    if (action === 'skip' && step.kind !== 'OPTIONAL_INFO') {
      throw new BadRequestException('Этот этап нельзя пропустить');
    }
    if (step.kind === 'REQUIRED_ACTION') {
      const ready = await this.requiredActionReady(tenantId, platformAccountId, step.completionKey);
      if (!ready) throw new ConflictException('Сначала выполните обязательное действие этого этапа');
    }
    if (step.kind === 'REQUIRED_INFO' && !existingStep?.modalSeenAt) {
      throw new ConflictException('Сначала ознакомьтесь с информацией этого этапа');
    }

    const now = new Date();
    const ordered = progress.scenarioVersion.steps;
    const index = ordered.findIndex((item) => item.id === step.id);
    const next = index >= 0 ? ordered[index + 1] || null : null;
    const final = !next;
    const stepStatus = action === 'skip' ? 'SKIPPED' : 'COMPLETED';

    await this.prisma.$transaction(async (tx) => {
      await tx.firstRunStepProgress.upsert({
        where: { progressId_stepId: { progressId: progress.id, stepId: step.id } },
        create: {
          progressId: progress.id,
          stepId: step.id,
          status: stepStatus,
          modalSeenAt: existingStep?.modalSeenAt || now,
          startedAt: existingStep?.startedAt || now,
          completedAt: action === 'complete' ? now : null,
          skippedAt: action === 'skip' ? now : null,
          lastSeenAt: now,
        },
        update: {
          status: stepStatus,
          completedAt: action === 'complete' ? now : null,
          skippedAt: action === 'skip' ? now : null,
          lastSeenAt: now,
        },
      });
      await tx.firstRunProgress.update({
        where: { id: progress.id },
        data: final
          ? { status: 'COMPLETED', currentStepKey: '', completedAt: now }
          : { currentStepKey: next.key },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          platformAccountId,
          sessionId: sessionId || null,
          eventType: action === 'skip' ? 'STEP_SKIPPED' : 'STEP_COMPLETED',
          stepKey: step.key,
          scenarioVersionId: progress.scenarioVersionId,
          metadata: json({ nextStepKey: next?.key || '', kind: step.kind }),
          occurredAt: now,
        },
      });
      if (next) {
        await tx.platformActivityEvent.create({
          data: {
            tenantId,
            platformAccountId,
            sessionId: sessionId || null,
            eventType: 'STEP_AVAILABLE',
            stepKey: next.key,
            scenarioVersionId: progress.scenarioVersionId,
            metadata: json({ previousStepKey: step.key }),
            occurredAt: now,
          },
        });
      } else {
        await tx.platformAccount.update({
          where: { id: platformAccountId },
          data: { workspaceUnlocked: true },
        });
        await tx.platformActivityEvent.create({
          data: {
            tenantId,
            platformAccountId,
            sessionId: sessionId || null,
            eventType: 'FIRST_RUN_COMPLETED',
            scenarioVersionId: progress.scenarioVersionId,
            metadata: json({}),
            occurredAt: now,
          },
        });
      }
    });

    if (final) {
      const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
      if (access?.commercialMode === 'LIVE') await this.cleanupDemoOperationalData(tenantId);
    }

    return this.state(tenantId, platformAccountId);
  }

  async startSession(tenantId: string, platformAccountId: string) {
    await this.expireStaleSessions(tenantId, platformAccountId);
    const now = new Date();
    const session = await this.prisma.platformSession.create({
      data: { tenantId, platformAccountId, startedAt: now, lastSeenAt: now },
    });
    await this.prisma.platformActivityEvent.create({
      data: {
        tenantId,
        platformAccountId,
        sessionId: session.id,
        eventType: 'SESSION_STARTED',
        metadata: json({}),
        occurredAt: now,
      },
    });
    return { id: session.id, startedAt: session.startedAt.toISOString() };
  }

  async heartbeat(tenantId: string, platformAccountId: string, sessionId: string) {
    const session = await this.prisma.platformSession.findUnique({ where: { id: sessionId } });
    if (!session || session.tenantId !== tenantId || session.platformAccountId !== platformAccountId || session.endedAt) {
      throw new NotFoundException('Активный сеанс не найден');
    }
    const updated = await this.prisma.platformSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
    return { id: updated.id, lastSeenAt: updated.lastSeenAt.toISOString() };
  }

  async endSession(tenantId: string, platformAccountId: string, sessionId: string, reasonValue: unknown = 'LOGOUT') {
    const session = await this.prisma.platformSession.findUnique({ where: { id: sessionId } });
    if (!session || session.tenantId !== tenantId || session.platformAccountId !== platformAccountId) return { ended: false };
    if (session.endedAt) return { ended: true, endedAt: session.endedAt.toISOString() };
    const now = new Date();
    const reason = text(reasonValue) || 'LOGOUT';
    await this.prisma.$transaction(async (tx) => {
      await tx.platformSession.update({
        where: { id: session.id },
        data: { endedAt: now, lastSeenAt: now, endReason: reason },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          platformAccountId,
          sessionId: session.id,
          eventType: 'SESSION_ENDED',
          metadata: json({ reason }),
          occurredAt: now,
        },
      });
    });
    return { ended: true, endedAt: now.toISOString() };
  }

  private async expireStaleSessions(tenantId?: string, platformAccountId?: string) {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
    const sessions = await this.prisma.platformSession.findMany({
      where: {
        endedAt: null,
        lastSeenAt: { lt: cutoff },
        ...(tenantId ? { tenantId } : {}),
        ...(platformAccountId ? { platformAccountId } : {}),
      },
    });
    for (const session of sessions) {
      await this.prisma.$transaction(async (tx) => {
        await tx.platformSession.update({
          where: { id: session.id },
          data: { endedAt: session.lastSeenAt, endReason: 'TIMEOUT' },
        });
        await tx.platformActivityEvent.create({
          data: {
            tenantId: session.tenantId,
            platformAccountId: session.platformAccountId,
            sessionId: session.id,
            eventType: 'SESSION_ENDED',
            metadata: json({ reason: 'TIMEOUT' }),
            occurredAt: session.lastSeenAt,
          },
        });
      });
    }
  }

  async recordActivity(
    tenantId: string,
    platformAccountId: string,
    input: { eventType?: unknown; stepKey?: unknown; scenarioVersionId?: unknown; metadata?: unknown; sessionId?: unknown },
  ) {
    const eventType = text(input?.eventType).toUpperCase();
    if (!eventType || !/^[A-Z0-9_:-]{2,80}$/.test(eventType)) throw new BadRequestException('Некорректный тип события');
    const event = await this.prisma.platformActivityEvent.create({
      data: {
        tenantId,
        platformAccountId,
        sessionId: text(input?.sessionId) || null,
        eventType,
        stepKey: text(input?.stepKey),
        scenarioVersionId: text(input?.scenarioVersionId),
        metadata: json(objectValue(input?.metadata)),
        occurredAt: new Date(),
      },
    });
    return { id: event.id, occurredAt: event.occurredAt.toISOString() };
  }

  async requestLive(tenantId: string, platformAccountId: string) {
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');
    if (access.commercialMode === 'LIVE' && (access.isOwnerBook || access.liveApprovedAt)) {
      return { requested: false, alreadyLive: true };
    }

    const recent = await this.prisma.platformActivityEvent.findFirst({
      where: {
        tenantId,
        platformAccountId,
        eventType: 'LIVE_REQUESTED',
        occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { occurredAt: 'desc' },
    });
    if (recent) return { requested: true, duplicate: true, occurredAt: recent.occurredAt.toISOString() };

    const event = await this.prisma.platformActivityEvent.create({
      data: {
        tenantId,
        platformAccountId,
        eventType: 'LIVE_REQUESTED',
        metadata: json({
          firstRunStatus: (await this.prisma.firstRunProgress.findUnique({
            where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
            select: { status: true, currentStepKey: true },
          })) || null,
        }),
        occurredAt: new Date(),
      },
    });
    return { requested: true, occurredAt: event.occurredAt.toISOString() };
  }

  async requestDemoExtension(tenantId: string, platformAccountId: string) {
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');
    if (access.commercialMode === 'LIVE') {
      throw new ConflictException('Продление DEMO не требуется в режиме LIVE');
    }

    const recent = await this.prisma.platformActivityEvent.findFirst({
      where: {
        tenantId,
        platformAccountId,
        eventType: 'DEMO_EXTENSION_REQUESTED',
        occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { occurredAt: 'desc' },
    });
    if (recent) return { requested: true, duplicate: true, occurredAt: recent.occurredAt.toISOString() };

    const event = await this.prisma.platformActivityEvent.create({
      data: {
        tenantId,
        platformAccountId,
        eventType: 'DEMO_EXTENSION_REQUESTED',
        metadata: json({
          demoExpiresAt: access.demoExpiresAt?.toISOString() || '',
        }),
        occurredAt: new Date(),
      },
    });
    return { requested: true, occurredAt: event.occurredAt.toISOString() };
  }

  async assertRealOperationsAllowed(tenantId: string) {
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) {
      throw new NotFoundException('Состояние рабочего пространства не настроено');
    }
    if (access.status !== 'ACTIVE') {
      throw new ForbiddenException('Рабочее пространство временно недоступно');
    }
    if (access.commercialMode !== 'LIVE') {
      throw new ForbiddenException('Реальные внешние действия доступны после перехода в LIVE');
    }
    if (!access.isOwnerBook && !access.liveApprovedAt) {
      throw new ForbiddenException('LIVE доступен после подтверждения администратором');
    }
    return true;
  }

  async setCommercialMode(tenantId: string, modeValue: unknown, platformAdminId = '') {
    const mode = text(modeValue).toUpperCase();
    if (!['DEMO', 'LIVE'].includes(mode)) throw new BadRequestException('Неизвестный режим');

    const approvedByAdminId = text(platformAdminId);
    if (mode === 'LIVE' && !approvedByAdminId) {
      throw new BadRequestException('LIVE требует явного подтверждения администратора');
    }

    const now = new Date();
    const access = await this.prisma.$transaction(async (tx) => {
      const current = await tx.tenantAccess.findUnique({ where: { tenantId } });
      if (!current) throw new NotFoundException('Рабочее пространство не найдено');

      if (
        mode === 'LIVE'
        && current.commercialMode === 'LIVE'
        && current.liveApprovedAt
        && current.liveApprovedByAdminId
      ) {
        return current;
      }

      const updated = await tx.tenantAccess.update({
        where: { tenantId },
        data: mode === 'LIVE'
          ? {
            commercialMode: 'LIVE',
            liveApprovedAt: now,
            liveApprovedByAdminId: approvedByAdminId,
          }
          : {
            commercialMode: 'DEMO',
            liveApprovedAt: null,
            liveApprovedByAdminId: null,
          },
      });

      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'COMMERCIAL_MODE_CHANGED',
          metadata: json({
            from: current.commercialMode,
            commercialMode: mode,
            approvedByAdminId: mode === 'LIVE' ? approvedByAdminId : '',
          }),
          occurredAt: now,
        },
      });

      if (mode === 'LIVE') {
        await tx.platformActivityEvent.create({
          data: {
            tenantId,
            eventType: 'LIVE_APPROVED_BY_ADMIN',
            metadata: json({ platformAdminId: approvedByAdminId }),
            occurredAt: now,
          },
        });
      }

      return updated;
    });

    if (mode === 'LIVE') {
      const completed = await this.prisma.firstRunProgress.findFirst({ where: { tenantId, status: 'COMPLETED' } });
      if (completed) await this.cleanupDemoOperationalData(tenantId);
    }

    return {
      commercialMode: access.commercialMode,
      demoActivatedAt: access.demoActivatedAt?.toISOString() || '',
      demoExpiresAt: access.demoExpiresAt?.toISOString() || '',
      liveApprovedAt: access.liveApprovedAt?.toISOString() || '',
      liveApprovedByAdminId: access.liveApprovedByAdminId || '',
    };
  }

  async extendDemo(tenantId: string, daysValue: unknown = DEMO_DAYS) {
    const days = Math.min(90, Math.max(1, Number(daysValue) || DEMO_DAYS));
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');
    const base = access.demoExpiresAt && access.demoExpiresAt.getTime() > Date.now()
      ? access.demoExpiresAt
      : new Date();
    const expiresAt = addDays(base, days);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantAccess.update({
        where: { tenantId },
        data: { demoExpiresAt: expiresAt, demoExtendedAt: now },
      });
      await tx.tenantInvitation.updateMany({
        where: { tenantId },
        data: { demoExpiresAt: expiresAt },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'DEMO_EXTENDED',
          metadata: json({ days, expiresAt: expiresAt.toISOString() }),
          occurredAt: now,
        },
      });
    });
    return { expiresAt: expiresAt.toISOString(), days };
  }

  async cleanupDemoOperationalData(tenantId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.financeSettlement.deleteMany({ where: { tenantId } });
      await tx.financeOperation.deleteMany({ where: { tenantId } });
      await tx.recordEvent.deleteMany({ where: { tenantId } });
      await tx.record.deleteMany({ where: { tenantId } });
      await tx.person.deleteMany({ where: { tenantId } });
      await tx.bookingRequest.deleteMany({ where: { tenantId } });
      await tx.ueiState.updateMany({
        where: { tenantId },
        data: { data: json({ entities: {}, relations: {}, revoked: [] }) },
      });
      await tx.$executeRaw`DELETE FROM "NotificationDelivery" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "Notification" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationMessage" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationIdentity" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationPreference" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationBroadcastRun" WHERE "tenantId" = ${tenantId}`;
    });
    await this.prisma.platformActivityEvent.create({
      data: {
        tenantId,
        eventType: 'DEMO_OPERATIONAL_DATA_CLEARED',
        metadata: json({}),
        occurredAt: new Date(),
      },
    });
    return { cleared: true };
  }

  private async ensureDraft() {
    const scenario = await this.prisma.firstRunScenario.findUnique({ where: { key: SCENARIO_KEY } });
    if (!scenario) throw new NotFoundException('Сценарий не найден');
    const existing = await this.prisma.firstRunScenarioVersion.findFirst({
      where: { scenarioId: scenario.id, status: 'DRAFT' },
      orderBy: { version: 'desc' },
      include: { steps: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (existing) return existing;

    const published = await this.prisma.firstRunScenarioVersion.findFirst({
      where: { scenarioId: scenario.id, status: 'PUBLISHED' },
      orderBy: [{ version: 'desc' }, { publishedAt: 'desc' }],
      include: { steps: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!published) throw new NotFoundException('Опубликованная версия не найдена');
    const max = await this.prisma.firstRunScenarioVersion.aggregate({
      where: { scenarioId: scenario.id },
      _max: { version: true },
    });
    const nextVersion = Math.max(published.version + 1, Number(max._max.version || 0) + 1);

    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.firstRunScenarioVersion.create({
        data: { scenarioId: scenario.id, version: nextVersion, status: 'DRAFT' },
      });
      for (const step of published.steps) {
        await tx.firstRunStep.create({
          data: {
            scenarioVersionId: draft.id,
            key: step.key,
            position: step.position,
            kind: step.kind,
            title: step.title,
            modalTitle: step.modalTitle,
            modalBody: step.modalBody,
            primaryLabel: step.primaryLabel,
            skipLabel: step.skipLabel,
            route: step.route,
            target: step.target,
            completionKey: step.completionKey,
            metadata: json(step.metadata),
            isActive: step.isActive,
          },
        });
      }
      return tx.firstRunScenarioVersion.findUniqueOrThrow({
        where: { id: draft.id },
        include: { steps: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
      });
    });
  }

  async ensureAdminDraft() {
    await this.ensureDraft();
    return this.adminScenario();
  }

  async adminScenario() {
    const scenario = await this.prisma.firstRunScenario.findUnique({ where: { key: SCENARIO_KEY } });
    if (!scenario) throw new NotFoundException('Сценарий не найден');
    const versions = await this.prisma.firstRunScenarioVersion.findMany({
      where: { scenarioId: scenario.id },
      orderBy: { version: 'desc' },
      include: { steps: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    return {
      scenario: { id: scenario.id, key: scenario.key, title: scenario.title },
      published: versions.find((item) => item.status === 'PUBLISHED') || null,
      draft: versions.find((item) => item.status === 'DRAFT') || null,
      versions: versions.map((item) => ({
        id: item.id,
        version: item.version,
        status: item.status,
        publishedAt: item.publishedAt?.toISOString() || '',
        createdAt: item.createdAt.toISOString(),
        steps: item.steps.map((step) => ({
          key: step.key,
          position: step.position,
          kind: step.kind,
          title: step.title,
          modalTitle: step.modalTitle,
          modalBody: step.modalBody,
          primaryLabel: step.primaryLabel,
          skipLabel: step.skipLabel,
          route: step.route,
          target: step.target,
          completionKey: step.completionKey,
          metadata: step.metadata,
          isActive: step.isActive,
        })),
      })),
    };
  }

  async updateDraftStep(stepKeyValue: unknown, input: Record<string, unknown>) {
    const stepKey = text(stepKeyValue);
    const draft = await this.ensureDraft();
    const step = draft.steps.find((item) => item.key === stepKey);
    if (!step) throw new NotFoundException('Этап не найден');

    const allowedKind = ['REQUIRED_ACTION', 'REQUIRED_INFO', 'OPTIONAL_INFO', 'SYSTEM'];
    const kind = input.kind == null ? step.kind : text(input.kind).toUpperCase();
    if (!allowedKind.includes(kind)) throw new BadRequestException('Некорректный тип этапа');

    await this.prisma.firstRunStep.update({
      where: { id: step.id },
      data: {
        title: input.title == null ? undefined : text(input.title),
        modalTitle: input.modalTitle == null ? undefined : text(input.modalTitle),
        modalBody: input.modalBody == null ? undefined : String(input.modalBody || '').trim(),
        primaryLabel: input.primaryLabel == null ? undefined : text(input.primaryLabel),
        skipLabel: input.skipLabel == null ? undefined : text(input.skipLabel),
        kind,
        isActive: input.isActive == null ? undefined : Boolean(input.isActive),
        metadata: input.metadata == null ? undefined : json(objectValue(input.metadata)),
      },
    });
    return this.adminScenario();
  }

  async reorderDraft(stepKeysValue: unknown) {
    const stepKeys = arrayValue(stepKeysValue).map(text).filter(Boolean);
    const draft = await this.ensureDraft();
    const existing = draft.steps.map((item) => item.key);
    if (stepKeys.length !== existing.length || new Set(stepKeys).size !== existing.length || existing.some((key) => !stepKeys.includes(key))) {
      throw new BadRequestException('Передайте полный порядок этапов без дублей');
    }
    await this.prisma.$transaction(
      stepKeys.map((key, index) => this.prisma.firstRunStep.update({
        where: { scenarioVersionId_key: { scenarioVersionId: draft.id, key } },
        data: { position: (index + 1) * 10 },
      })),
    );
    return this.adminScenario();
  }

  async publishDraft() {
    const draft = await this.ensureDraft();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.firstRunScenarioVersion.updateMany({
        where: { scenarioId: draft.scenarioId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });
      await tx.firstRunScenarioVersion.update({
        where: { id: draft.id },
        data: { status: 'PUBLISHED', publishedAt: now },
      });
    });
    return this.adminScenario();
  }

  async adminActivity(tenantId: string) {
    await this.expireStaleSessions(tenantId);
    const [sessions, events, progress] = await Promise.all([
      this.prisma.platformSession.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: 100,
      }),
      this.prisma.platformActivityEvent.findMany({
        where: { tenantId },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      }),
      this.prisma.firstRunProgress.findFirst({
        where: { tenantId },
        include: {
          scenarioVersion: true,
          steps: { include: { step: true }, orderBy: { updatedAt: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const totalActiveMs = sessions.reduce((sum, session) => {
      const end = session.endedAt || session.lastSeenAt;
      return sum + Math.max(0, end.getTime() - session.startedAt.getTime());
    }, 0);
    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        endedAt: session.endedAt?.toISOString() || '',
        endReason: session.endReason,
        durationSeconds: Math.round(Math.max(0, ((session.endedAt || session.lastSeenAt).getTime() - session.startedAt.getTime()) / 1000)),
      })),
      totalActiveSeconds: Math.round(totalActiveMs / 1000),
      lastActivityAt: events[0]?.occurredAt.toISOString() || '',
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        stepKey: event.stepKey,
        scenarioVersionId: event.scenarioVersionId,
        metadata: event.metadata,
        occurredAt: event.occurredAt.toISOString(),
      })),
      progress: progress ? {
        status: progress.status,
        currentStepKey: progress.currentStepKey,
        scenarioVersion: progress.scenarioVersion.version,
        startedAt: progress.startedAt.toISOString(),
        completedAt: progress.completedAt?.toISOString() || '',
        steps: progress.steps.map((item) => ({
          key: item.step.key,
          title: item.step.title,
          status: item.status,
          startedAt: item.startedAt?.toISOString() || '',
          completedAt: item.completedAt?.toISOString() || '',
          skippedAt: item.skippedAt?.toISOString() || '',
        })),
      } : null,
    };
  }

  async adminAnalytics() {
    const versions = await this.prisma.firstRunScenarioVersion.findMany({
      where: { scenario: { key: SCENARIO_KEY } },
      orderBy: { version: 'desc' },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    const result = [];
    for (const version of versions) {
      const progress = await this.prisma.firstRunProgress.findMany({
        where: { scenarioVersionId: version.id },
        include: { steps: true },
      });
      result.push({
        version: version.version,
        status: version.status,
        publishedAt: version.publishedAt?.toISOString() || '',
        assigned: progress.length,
        completed: progress.filter((item) => item.status === 'COMPLETED').length,
        steps: version.steps.map((step) => {
          const rows = progress.flatMap((item) => item.steps.filter((entry) => entry.stepId === step.id));
          return {
            key: step.key,
            title: step.title,
            position: step.position,
            shown: rows.filter((item) => item.modalSeenAt).length,
            completed: rows.filter((item) => item.status === 'COMPLETED').length,
            skipped: rows.filter((item) => item.status === 'SKIPPED').length,
          };
        }),
      });
    }
    return result;
  }
}
