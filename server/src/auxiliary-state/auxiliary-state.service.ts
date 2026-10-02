import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
};

const DATASETS = new Set(['wallets', 'investments', 'loans', 'tags', 'products', 'productHistory']);

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
  };
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value: AuxiliaryBundle) {
  return JSON.stringify(stable(normalize(value)));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class AuxiliaryStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
  ) {}

  private async bundle(tenantId: string) {
    const row = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    return {
      migrated: Boolean(row),
      verified: Boolean(row?.migrationVerifiedAt),
      migrationVerifiedAt: row?.migrationVerifiedAt || null,
      ...normalize(row?.data || {}),
    };
  }

  get(tenantId: string) {
    return this.bundle(tenantId);
  }

  private async requireVerified(tenantId: string) {
    const row = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    if (!row?.migrationVerifiedAt) throw new ConflictException('Перенос связанных данных ещё не подтверждён');
    return row;
  }

  async migrate(tenantId: string, body: unknown) {
    const expected = normalize(body);
    const existing = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessAuxiliaryState.create({ data: { tenantId, data: json(expected) } });
    }
    return this.bundle(tenantId);
  }

  async verifyMigration(tenantId: string, body: unknown) {
    const expected = normalize(body);
    const current = await this.bundle(tenantId);
    if (!current.migrated) throw new ConflictException('Связанные данные ещё не перенесены');
    const actual = normalize(current);
    if (canonical(actual) !== canonical(expected)) {
      throw new ConflictException('Проверка переноса связанных данных не пройдена');
    }
    await this.prisma.businessAuxiliaryState.update({ where: { tenantId }, data: { migrationVerifiedAt: new Date() } });
    return this.bundle(tenantId);
  }

  async bootstrap(tenantId: string) {
    const existing = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    if (!existing) {
      await this.prisma.businessAuxiliaryState.create({
        data: { tenantId, data: json(normalize({})), migrationVerifiedAt: new Date() },
      });
    }
    return this.bundle(tenantId);
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
    const row = await this.requireVerified(tenantId);
    const current = normalize(row.data);
    const value = objectValue(body).value;
    const requested = Array.isArray(value) ? clone(value) : [];
    const next = key === 'investments'
      ? this.protectInvestmentAgreements(current.investments, requested)
      : requested;
    if (key === 'investments') {
      await this.assertInvestmentMutationAllowed(tenantId, current.investments, next);
    }
    (current as any)[key] = next;
    await this.prisma.businessAuxiliaryState.update({ where: { tenantId }, data: { data: json(current) } });
    return current;
  }
}
