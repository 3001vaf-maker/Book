import { Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityAccessChangeType, CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type ResolutionSource = 'TENANT_OVERRIDE' | 'PLAN' | 'DEFAULT' | 'OWNER_BOOK' | 'MISSING_ACCESS' | 'SUSPENDED';

export type ResolvedCapability = {
  key: string;
  valueType: CapabilityValueType;
  enabled: boolean | null;
  limit: number | null;
  source: ResolutionSource;
};

export type ResolvedTenantAccess = {
  tenantId: string;
  status: TenantAccessStatus | 'MISSING_ACCESS';
  isPlatformOwnerWorkspace: boolean;
  plan: { id: string; key: string; name: string } | null;
  capabilities: ResolvedCapability[];
};

@Injectable()
export class SaasAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCapability(tenantId: string, capabilityKey: string): Promise<ResolvedCapability> {
    const capability = await this.prisma.capability.findUnique({ where: { key: capabilityKey } });
    if (!capability || !capability.isActive) {
      throw new NotFoundException(`Неизвестная возможность Book: ${capabilityKey}`);
    }

    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      include: {
        plan: {
          include: {
            capabilityValues: {
              where: { capabilityId: capability.id },
              take: 1,
            },
          },
        },
        overrides: {
          where: { capabilityId: capability.id },
          take: 1,
        },
      },
    });

    if (!access) return this.deniedValue(capability.key, capability.valueType, 'MISSING_ACCESS');
    if (access.isPlatformOwnerWorkspace) return this.ownerValue(capability.key, capability.valueType);
    if (access.status === TenantAccessStatus.SUSPENDED) return this.deniedValue(capability.key, capability.valueType, 'SUSPENDED');

    const override = access.overrides[0];
    const planValue = access.plan?.capabilityValues[0];

    if (capability.valueType === CapabilityValueType.BOOLEAN) {
      if (override && override.enabled !== null) {
        return { key: capability.key, valueType: capability.valueType, enabled: override.enabled, limit: null, source: 'TENANT_OVERRIDE' };
      }
      if (planValue && planValue.enabled !== null) {
        return { key: capability.key, valueType: capability.valueType, enabled: planValue.enabled, limit: null, source: 'PLAN' };
      }
      return { key: capability.key, valueType: capability.valueType, enabled: capability.defaultEnabled, limit: null, source: 'DEFAULT' };
    }

    if (override) {
      return { key: capability.key, valueType: capability.valueType, enabled: null, limit: override.limit, source: 'TENANT_OVERRIDE' };
    }
    if (planValue) {
      return { key: capability.key, valueType: capability.valueType, enabled: null, limit: planValue.limit, source: 'PLAN' };
    }
    return { key: capability.key, valueType: capability.valueType, enabled: null, limit: capability.defaultLimit, source: 'DEFAULT' };
  }

  async resolveTenantAccess(tenantId: string): Promise<ResolvedTenantAccess> {
    const capabilities = await this.prisma.capability.findMany({
      where: { isActive: true },
      orderBy: [{ groupKey: 'asc' }, { position: 'asc' }, { key: 'asc' }],
    });

    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      include: { plan: { include: { capabilityValues: true } }, overrides: true },
    });

    if (!access) {
      return {
        tenantId,
        status: 'MISSING_ACCESS',
        isPlatformOwnerWorkspace: false,
        plan: null,
        capabilities: capabilities.map((capability) => this.deniedValue(capability.key, capability.valueType, 'MISSING_ACCESS')),
      };
    }

    const planValues = new Map(access.plan?.capabilityValues.map((value) => [value.capabilityId, value]) || []);
    const overrides = new Map(access.overrides.map((value) => [value.capabilityId, value]));

    const resolved = capabilities.map<ResolvedCapability>((capability) => {
      if (access.isPlatformOwnerWorkspace) return this.ownerValue(capability.key, capability.valueType);
      if (access.status === TenantAccessStatus.SUSPENDED) {
        return this.deniedValue(capability.key, capability.valueType, 'SUSPENDED');
      }

      const override = overrides.get(capability.id);
      const planValue = planValues.get(capability.id);
      if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (override && override.enabled !== null) {
          return { key: capability.key, valueType: capability.valueType, enabled: override.enabled, limit: null, source: 'TENANT_OVERRIDE' };
        }
        if (planValue && planValue.enabled !== null) {
          return { key: capability.key, valueType: capability.valueType, enabled: planValue.enabled, limit: null, source: 'PLAN' };
        }
        return { key: capability.key, valueType: capability.valueType, enabled: capability.defaultEnabled, limit: null, source: 'DEFAULT' };
      }

      if (override) {
        return { key: capability.key, valueType: capability.valueType, enabled: null, limit: override.limit, source: 'TENANT_OVERRIDE' };
      }
      if (planValue) {
        return { key: capability.key, valueType: capability.valueType, enabled: null, limit: planValue.limit, source: 'PLAN' };
      }
      return { key: capability.key, valueType: capability.valueType, enabled: null, limit: capability.defaultLimit, source: 'DEFAULT' };
    });

    return {
      tenantId,
      status: access.status,
      isPlatformOwnerWorkspace: access.isPlatformOwnerWorkspace,
      plan: access.plan ? { id: access.plan.id, key: access.plan.key, name: access.plan.name } : null,
      capabilities: resolved,
    };
  }

  async pendingCapabilityChanges(tenantId: string) {
    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      select: { isPlatformOwnerWorkspace: true },
    });
    if (access?.isPlatformOwnerWorkspace) return { summaries: [], introductions: [] };

    const events = await this.prisma.capabilityAccessEvent.findMany({
      where: {
        tenantId,
        cancelledAt: null,
        OR: [
          { summaryAcknowledgedAt: null },
          { changeType: CapabilityAccessChangeType.ENABLED, detailAcknowledgedAt: null },
        ],
      },
      include: { capability: { select: { key: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const summaryMap = new Map<string, {
      batchId: string;
      createdAt: Date;
      changes: Array<{ eventId: string; key: string; changeType: CapabilityAccessChangeType }>;
    }>();

    for (const event of events) {
      if (event.summaryAcknowledgedAt) continue;
      const current = summaryMap.get(event.batchId) || { batchId: event.batchId, createdAt: event.createdAt, changes: [] };
      current.changes.push({ eventId: event.id, key: event.capability.key, changeType: event.changeType });
      summaryMap.set(event.batchId, current);
    }

    const summaries = [...summaryMap.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const introductions = events
      .filter((event) => event.changeType === CapabilityAccessChangeType.ENABLED && event.summaryAcknowledgedAt !== null && event.detailAcknowledgedAt === null)
      .map((event) => ({ eventId: event.id, batchId: event.batchId, key: event.capability.key, createdAt: event.createdAt }));

    return { summaries, introductions };
  }

  async acknowledgeCapabilitySummary(tenantId: string, batchId: string) {
    const id = String(batchId || '').trim();
    if (!id) throw new NotFoundException('Изменение доступа не найдено');
    await this.prisma.capabilityAccessEvent.updateMany({
      where: { tenantId, batchId: id, cancelledAt: null, summaryAcknowledgedAt: null },
      data: { summaryAcknowledgedAt: new Date() },
    });
    return this.pendingCapabilityChanges(tenantId);
  }

  async acknowledgeCapabilityIntroduction(tenantId: string, eventId: string) {
    const id = String(eventId || '').trim();
    if (!id) throw new NotFoundException('Знакомство с возможностью не найдено');
    await this.prisma.capabilityAccessEvent.updateMany({
      where: {
        id,
        tenantId,
        cancelledAt: null,
        changeType: CapabilityAccessChangeType.ENABLED,
        summaryAcknowledgedAt: { not: null },
        detailAcknowledgedAt: null,
      },
      data: { detailAcknowledgedAt: new Date() },
    });
    return this.pendingCapabilityChanges(tenantId);
  }

  private ownerValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: true, limit: null, source: 'OWNER_BOOK' };
    }
    return { key, valueType, enabled: null, limit: null, source: 'OWNER_BOOK' };
  }

  private deniedValue(key: string, valueType: CapabilityValueType, source: 'MISSING_ACCESS' | 'SUSPENDED'): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: false, limit: null, source };
    }
    return { key, valueType, enabled: null, limit: 0, source };
  }
}
