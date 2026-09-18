import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';

const PROFILE_CREATION_DOCUMENT_KEY = 'user-pd-consent';

type CurrentDocument = {
  id: string;
  key: string;
  type: string;
  title: string;
  versionId: string;
  version: number;
  content: string;
  contentHash: string;
  publishedAt: Date;
};

type AcceptanceRow = {
  action: string;
  occurredAt: Date;
};

@Injectable()
export class ProfileCreationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentDocument() {
    const rows = await this.prisma.$queryRaw<CurrentDocument[]>`
      SELECT
        d."id",
        d."key",
        d."type",
        d."title",
        v."id" AS "versionId",
        v."version",
        v."contentSnapshot" AS "content",
        v."contentHash",
        v."publishedAt"
      FROM "LegalDocument" d
      JOIN "LegalDocumentVersion" v
        ON v."documentId" = d."id"
       AND v."supersededAt" IS NULL
      WHERE d."scope" = 'PLATFORM'
        AND d."tenantId" IS NULL
        AND d."isActive" = true
        AND d."key" = ${PROFILE_CREATION_DOCUMENT_KEY}
      ORDER BY v."version" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  private async latestAcceptance(userId: string, versionId: string) {
    const rows = await this.prisma.$queryRaw<AcceptanceRow[]>`
      SELECT "action", "occurredAt"
      FROM "LegalAcceptanceEvent"
      WHERE "userId" = ${userId}
        AND "documentVersionId" = ${versionId}
      ORDER BY "occurredAt" DESC, "id" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async requirement(userId: string) {
    const document = await this.currentDocument();
    if (!document) {
      return {
        key: PROFILE_CREATION_DOCUMENT_KEY,
        configured: false,
        accepted: false,
        document: null,
      };
    }

    const acceptance = await this.latestAcceptance(userId, document.versionId);
    const accepted = acceptance?.action === 'CONSENTED' || acceptance?.action === 'ACCEPTED';

    return {
      key: PROFILE_CREATION_DOCUMENT_KEY,
      configured: true,
      accepted,
      document: {
        key: document.key,
        type: document.type,
        title: document.title,
        versionId: document.versionId,
        version: document.version,
        content: document.content,
        contentHash: document.contentHash,
        publishedAt: document.publishedAt,
      },
    };
  }

  async accept(tenantId: string, userId: string) {
    const requirement = await this.requirement(userId);
    if (!requirement.configured || !requirement.document) {
      throw new ConflictException({
        code: 'PROFILE_CREATION_DOCUMENT_MISSING',
        message: 'Документ для создания профиля не настроен владельцем платформы',
        key: PROFILE_CREATION_DOCUMENT_KEY,
      });
    }
    if (requirement.accepted) return requirement;

    await this.prisma.$executeRaw`
      INSERT INTO "LegalAcceptanceEvent" (
        "id", "tenantId", "userId", "documentVersionId",
        "action", "source", "technicalEvidence", "occurredAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${userId}, ${requirement.document.versionId},
        'CONSENTED', 'PROFILE_CREATION', '{}'::jsonb, CURRENT_TIMESTAMP
      )
    `;

    return this.requirement(userId);
  }

  async assertAccepted(userId: string) {
    const requirement = await this.requirement(userId);
    if (!requirement.configured) {
      throw new ConflictException({
        code: 'PROFILE_CREATION_DOCUMENT_MISSING',
        message: 'Документ для создания профиля не настроен владельцем платформы',
        key: PROFILE_CREATION_DOCUMENT_KEY,
      });
    }
    if (!requirement.accepted) {
      throw new ConflictException({
        code: 'PROFILE_CREATION_CONSENT_REQUIRED',
        message: 'Для создания профиля необходимо принять актуальную версию документа',
        requirement,
      });
    }
    return requirement;
  }
}
