import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mergeClientLoyaltyState } from '../loyalty/settlement-projection';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';

type JsonObject = Record<string, any>;
type AuxiliaryBundle = {
  wallets: JsonObject[];
  investments: JsonObject[];
  loans: JsonObject[];
  tags: JsonObject[];
  products: JsonObject[];
  productHistory: JsonObject[];
  cardAppearanceTemplates: JsonObject[];
  loyalty: JsonObject;
};

const DATASETS = new Set(['wallets', 'investments', 'loans', 'tags', 'products', 'productHistory', 'cardAppearanceTemplates', 'loyalty']);

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalize(value: unknown): AuxiliaryBundle {
  const source = objectValue(value);
  return {
    wallets: (Array.isArray(source.wallets) ? source.wallets : []).map((item) => clone(objectValue(item))),
    investments: (Array.isArray(source.investments) ? source.investments : []).map((item) => clone(objectValue(item))),
    loans: (Array.isArray(source.loans) ? source.loans : []).map((item) => clone(objectValue(item))),
    tags: (Array.isArray(source.tags) ? source.tags : []).map((item) => clone(objectValue(item))),
    products: (Array.isArray(source.products) ? source.products : []).map((item) => clone(objectValue(item))),
    productHistory: (Array.isArray(source.productHistory) ? source.productHistory : []).map((item) => clone(objectValue(item))),
    cardAppearanceTemplates: (Array.isArray(source.cardAppearanceTemplates) ? source.cardAppearanceTemplates : []).map((item) => clone(objectValue(item))),
    loyalty: clone(objectValue(source.loyalty)),
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

function retryable(error: unknown) {
  const source = objectValue(error);
  const code = text(source.code);
  return code === 'P2034' || code === '40001';
}

@Injectable()
export class AuxiliaryStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
  ) {}

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === 2) throw error;
      }
    }
    throw lastError;
  }

  private async ensureState(db: PrismaService | Prisma.TransactionClient, tenantId: string) {
    return db.businessAuxiliaryState.upsert({
      where: { tenantId },
      create: { tenantId, data: json(normalize({})) },
      update: {},
    });
  }

  async get(tenantId: string) {
    const row = await this.ensureState(this.prisma, tenantId);
    return normalize(row.data);
  }

  private investmentRole(value: unknown) {
    const entity = objectValue(value);
    const terms = objectValue(entity.investmentTerms);
    const role = text(terms.role);
    return ['self', 'raise', 'external'].includes(role) ? role : 'raise';
  }

  private protectInvestmentAgreements(before: unknown[], after: unknown[]) {
    const beforeById = new Map<string, JsonObject>(
      before
        .map((value): [string, JsonObject] => {
          const entity = objectValue(value);
          return [text(entity.id), entity];
        })
        .filter(([id]) => Boolean(id)),
    );

    return after.map((value) => {
      const entity = clone(objectValue(value));
      const id = text(entity.id);
      if (!id) return entity;

      const previous = beforeById.get(id);
      const incomingTerms = objectValue(entity.investmentTerms);
      if (!previous) {
        if (this.investmentRole(entity) !== 'raise') return entity;
        const participantAccountId = text(incomingTerms.participantAccountId);
        entity.investmentTerms = {
          ...incomingTerms,
          participantStatus: participantAccountId ? 'pending' : '',
          participantRespondedAt: '',
        };
        return entity;
      }

      const previousTerms = objectValue(previous.investmentTerms);
      const previousRole = this.investmentRole(previous);
      const previousStatus = text(previousTerms.participantStatus);
      const previousParticipantId = text(previousTerms.participantAccountId);
      const nextParticipantId = text(incomingTerms.participantAccountId);

      if (previousStatus === 'accepted') {
        entity.investmentTerms = clone(previousTerms);
        return entity;
      }

      let participantStatus = previousStatus;
      let participantRespondedAt = text(previousTerms.participantRespondedAt);
      if (previousRole === 'raise' && nextParticipantId !== previousParticipantId) {
        participantStatus = nextParticipantId ? 'pending' : '';
        participantRespondedAt = '';
      }

      entity.investmentTerms = {
        ...incomingTerms,
        role: previousRole,
        participantStatus,
        participantRespondedAt,
      };
      return entity;
    });
  }

  private async assertInvestmentMutationAllowed(tenantId: string, before: unknown[], after: unknown[]) {
    const beforeById = new Map<string, JsonObject>(
      before
        .map((value): [string, JsonObject] => {
          const entity = objectValue(value);
          return [text(entity.id), entity];
        })
        .filter(([id]) => Boolean(id)),
    );
    const changedRoles = new Set<string>();
    for (const value of after) {
      const entity = objectValue(value);
      const id = text(entity.id);
      if (!id) continue;
      const previous = beforeById.get(id);
      if (previous && JSON.stringify(stable(previous)) === JSON.stringify(stable(entity))) continue;
      changedRoles.add(this.investmentRole(entity));
    }
    for (const role of changedRoles) {
      const capabilityKey = role === 'self'
        ? 'finance.investment.self.access'
        : role === 'external'
          ? 'finance.investment.external.access'
          : 'finance.investment.raise.access';
      const capability = await this.access.resolveCapability(tenantId, capabilityKey);
      if (capability.enabled !== true) throw new BadRequestException('Этот режим инвестиций недоступен');
    }
  }

  async updateDataset(tenantId: string, dataset: string, body: unknown) {
    const key = text(dataset);
    if (!DATASETS.has(key)) throw new BadRequestException('Неизвестный набор связанных данных');
    const value = objectValue(body).value;
    const requested: JsonObject | JsonObject[] = key === 'loyalty'
      ? clone(objectValue(value))
      : (Array.isArray(value) ? value.map((item) => clone(objectValue(item))) : []);

    return this.serializable(async (tx) => {
      const row = await this.ensureState(tx, tenantId);
      const current = normalize(row.data);
      let next: JsonObject | JsonObject[] = requested;

      if (key === 'loyalty') {
        next = mergeClientLoyaltyState(current.loyalty, requested);
      }
      if (key === 'investments') {
        next = this.protectInvestmentAgreements(current.investments, requested as JsonObject[]);
        await this.assertInvestmentMutationAllowed(tenantId, current.investments, next as JsonObject[]);
      }

      (current as any)[key] = next;
      await tx.businessAuxiliaryState.update({
        where: { tenantId },
        data: { data: json(current) },
      });
      return current;
    });
  }
}
