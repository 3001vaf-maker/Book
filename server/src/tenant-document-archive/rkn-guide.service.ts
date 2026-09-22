import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma.service';
import { TenantDocumentArchiveService } from './tenant-document-archive.service';

const RKN_GUIDE_TEMPLATE_KEY = 'rkn-notification-guide-template';

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

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

@Injectable()
export class RknGuideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentArchive: TenantDocumentArchiveService,
  ) {}

  private async template() {
    const rows = await this.prisma.$queryRaw<Array<{
      key: string;
      title: string;
      version: number;
      content: string;
    }>>`
      SELECT d."key", d."title", v."version", v."contentSnapshot" AS "content"
      FROM "PlatformDocument" d
      JOIN LATERAL (
        SELECT "version", "contentSnapshot"
        FROM "PlatformDocumentVersion"
        WHERE "documentId" = d."id"
        ORDER BY "version" DESC, "publishedAt" DESC
        LIMIT 1
      ) v ON true
      WHERE d."key" = ${RKN_GUIDE_TEMPLATE_KEY}
        AND d."isActive" = true
      LIMIT 1
    `;
    const template = rows[0];
    if (!template?.content) throw new ConflictException('Шаблон инструкции РКН не опубликован в Реестре документов');
    return template;
  }

  private async snapshot(tenantId: string, platformAccountId: string) {
    const [profile, operational] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
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

    return {
      fullName: [profile.name, profile.surname].map(text).filter(Boolean).join(' '),
      profession: text(profile.profession),
      phone: phones[0] || '',
      email: emails[0] || '',
      procedures,
    };
  }

  private personalize(
    templateContent: string,
    snapshotValue: unknown,
    templateVersion: number,
    personalVersion: number,
    generatedAt: Date,
    previousSnapshotValue: unknown = null,
  ) {
    const snapshot = objectValue(snapshotValue);
    const procedureLines = arrayValue(snapshot.procedures).map(text).filter(Boolean).map((value) => `• ${value}`);
    const previousSnapshot = objectValue(previousSnapshotValue);
    const previousProcedures = arrayValue(previousSnapshot.procedures).map(text).filter(Boolean);
    const changes: string[] = [];

    if (personalVersion > 1) {
      if (text(previousSnapshot.profession) !== text(snapshot.profession)) {
        changes.push(`Профессия: было «${text(previousSnapshot.profession) || 'не указана'}» → стало «${text(snapshot.profession) || 'не указана'}».`);
      }
      const currentProcedures = arrayValue(snapshot.procedures).map(text).filter(Boolean);
      const addedProcedures = currentProcedures.filter((value) => !previousProcedures.includes(value));
      const removedProcedures = previousProcedures.filter((value) => !currentProcedures.includes(value));
      if (addedProcedures.length) changes.push(`Добавлены услуги: ${addedProcedures.join('; ')}.`);
      if (removedProcedures.length) changes.push(`Убраны услуги: ${removedProcedures.join('; ')}.`);
      if (text(previousSnapshot.phone) !== text(snapshot.phone)) changes.push('Изменился контактный телефон.');
      if (text(previousSnapshot.email) !== text(snapshot.email)) changes.push('Изменилась электронная почта.');
    }

    const updateSection = personalVersion === 1
      ? [
        'Версия 1 — первичная инструкция.',
        'Используйте её для первичного заполнения уведомления, если фактическая деятельность совпадает с данными ниже.',
      ].join('\n')
      : [
        `Версия ${personalVersion} — инструкция по проверке и изменению ранее поданных сведений.`,
        '',
        'Что изменилось',
        ...(changes.length ? changes.map((value) => `• ${value}`) : ['• Изменился шаблон Book или сведения, влияющие на инструкцию.']),
        '',
        'Что делать',
        'Откройте форму изменения сведений Роскомнадзора и сравните ранее поданные сведения с текущими.',
        'Если изменилась профессия или услуги — заново проверьте цель обработки, категории персональных данных, категории субъектов, правовые основания, действия и способы обработки.',
        'Если новая деятельность фактически требует анализов, сведений о здоровье, противопоказаниях, диагнозах или лекарственных препаратах — отдельно проверьте специальные категории персональных данных. Не отмечайте и не снимайте эти категории только по названию профессии: учитывается то, какие данные вы реально собираете.',
        'Старая версия инструкции остаётся в Документах и не перезаписывается.',
      ].join('\n');

    const marketingSection = [
      'Что видите в форме',
      'Отдельная цель обработки для продвижения товаров, работ, услуг на рынке',
      '',
      'Что делать',
      'Добавлять эту цель только если вы фактически используете персональные данные для рекламных/маркетинговых сообщений.',
      'Для этой цели отмечать только те контактные данные и идентификаторы каналов, которые реально используются для рассылки.',
      'Правовое основание для рекламной цели не подменять договором: предварительное согласие на рекламу должно быть доказуемым.',
      '',
      'Почему',
      'Маркетинговая обработка отделяется от записи и оказания услуги. Если маркетинг не используется, отдельную маркетинговую цель не добавлять.',
    ].join('\n');

    const values: Record<string, string> = {
      FULL_NAME: text(snapshot.fullName) || 'не указано',
      PROFESSION: text(snapshot.profession) || 'не указана',
      PHONE: text(snapshot.phone) || 'не указан',
      EMAIL: text(snapshot.email) || 'не указан',
      PROCEDURES: procedureLines.length ? procedureLines.join('\n') : '• услуги не добавлены',
      UPDATE_SECTION: updateSection,
      MARKETING_SECTION: marketingSection,
      TEMPLATE_VERSION: String(templateVersion || 1),
      PERSONAL_VERSION: String(personalVersion || 1),
      GENERATED_AT: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(generatedAt),
    };

    let result = templateContent;
    for (const [key, value] of Object.entries(values)) result = result.split(`[[${key}]]`).join(value);
    return result;
  }

  private renderPdf(contentValue: unknown, titleValue: unknown) {
    const content = String(contentValue || '');
    const title = text(titleValue) || 'Инструкция по уведомлению Роскомнадзора';
    const regularFont = '/usr/share/fonts/dejavu/DejaVuSans.ttf';
    const boldFont = '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf';
    const doc = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 46, left: 48, right: 48 } });
    doc.font(regularFont);
    const chunks: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.info.Title = title;
    const lines = content.split(/\r?\n/);
    const majorHeading = /^(BOOK|ЭКРАН|ПОВТОРЯЮЩИЙСЯ|БЛОК|КОНТРОЛЬ|ПРОФЕССИЯ И УСЛУГИ)/;
    const labelHeading = /^(КАК ПОЛЬЗОВАТЬСЯ|ВАЖНО ОБ ОТВЕТСТВЕННОСТИ|ПЕРСОНАЛЬНЫЕ ДАННЫЕ ДЛЯ ЭТОЙ ИНСТРУКЦИИ|ПРОВЕРКА ПЕРЕД НАЧАЛОМ|МАРКЕТИНГ|СТАТУС ЭТОЙ ВЕРСИИ|Что видите в форме|Что делать|Что изменилось|Почему|Внимание|Проверить отдельно|Не ставить автоматически|Перед отправкой)$/;

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.45);
        continue;
      }
      if (majorHeading.test(line)) {
        doc.moveDown(0.35).font(boldFont).fontSize(line.startsWith('BOOK') ? 16 : 13).fillColor('#111111')
          .text(line, { paragraphGap: 4 });
        doc.font(regularFont).fontSize(10.2).fillColor('#111111');
        continue;
      }
      if (labelHeading.test(line)) {
        doc.moveDown(0.2).font(boldFont).fontSize(10.4).fillColor('#333333').text(line, { paragraphGap: 2 });
        doc.font(regularFont).fontSize(10.2).fillColor('#111111');
        continue;
      }
      if (/^[✓×•]/.test(line)) {
        doc.font(regularFont).fontSize(10.2).fillColor('#111111').text(line, { indent: 10, paragraphGap: 2 });
        continue;
      }
      doc.font(regularFont).fontSize(10.2).fillColor('#111111').text(line, { lineGap: 1.8, paragraphGap: 3 });
    }

    doc.end();
    return result;
  }

  async ensure(tenantId: string, platformAccountId: string) {
    const snapshot = await this.snapshot(tenantId, platformAccountId);
    if (!text(snapshot.fullName) || !text(snapshot.profession) || !snapshot.procedures.length) {
      return { ready: false, reason: 'PROFILE_OR_SERVICES_NOT_READY' };
    }

    const template = await this.template();
    const archive = await this.documentArchive.get(tenantId);
    if (!archive?.verified) throw new ConflictException('Архив документов ещё не готов');
    const documents = arrayValue(archive?.data?.documents);
    const canonicalGuides = documents.filter((item) => {
      const attachment = objectValue(objectValue(item).attachment);
      return (
        attachment.type === 'RKN_GUIDE_PDF'
        && text(attachment.templateKey) === RKN_GUIDE_TEMPLATE_KEY
        && Number(attachment.templateVersion || 0) > 0
        && Boolean(text(attachment.sourceHash))
        && Boolean(text(attachment.pdfBase64))
      );
    });

    const latestGuide = [...canonicalGuides].sort((left, right) => (
      Number(objectValue(right).version || 0) - Number(objectValue(left).version || 0)
    ))[0] || null;
    if (latestGuide) {
      const latestAttachment = objectValue(objectValue(latestGuide).attachment);
      if (
        Number(latestAttachment.templateVersion || 0) === template.version
        && sameJson(latestAttachment.snapshot, snapshot)
      ) {
        return { ready: true, document: latestGuide };
      }
    }

    const personalVersion = canonicalGuides.reduce(
      (maxVersion, item) => Math.max(maxVersion, Number(objectValue(item).version || 0)),
      0,
    ) + 1;
    const generatedAt = new Date();
    const previousSnapshot = latestGuide
      ? objectValue(objectValue(latestGuide).attachment).snapshot
      : null;
    const personalizedContent = this.personalize(
      template.content,
      snapshot,
      template.version,
      personalVersion,
      generatedAt,
      previousSnapshot,
    );
    const pdf = await this.renderPdf(personalizedContent, template.title);
    const document = await this.documentArchive.saveRknGuide(tenantId, {
      snapshot,
      templateKey: template.key,
      templateVersion: template.version,
      templateContent: template.content,
      personalizedContent,
      pdfBase64: pdf.toString('base64'),
    });
    return { ready: true, document };
  }

  async download(tenantId: string, platformAccountId: string, documentId = '') {
    const stored = documentId
      ? await this.documentArchive.rknGuideDocument(tenantId, documentId)
      : (await this.ensure(tenantId, platformAccountId)).document;
    if (!stored) throw new ConflictException('Персональная инструкция РКН ещё не готова');

    const attachment = objectValue((stored as JsonObject).attachment);
    const pdfBase64 = text(attachment.pdfBase64);
    if (!pdfBase64) throw new ConflictException('Сохранённая версия PDF недоступна');
    return {
      pdf: Buffer.from(pdfBase64, 'base64'),
      documentId: text((stored as JsonObject).id),
      fileName: text(attachment.fileName) || 'rkn-guide.pdf',
    };
  }
}
