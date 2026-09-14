import { Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type ResolutionSource = 'TENANT_OVERRIDE' | 'PLAN' | 'DEFAULT' | 'LEGACY_COMPAT' | 'SUSPENDED';

export type ResolvedCapability = {
  key: string;
  valueType: CapabilityValueType;
  enabled: boolean | null;
  limit: number | null;
  source: ResolutionSource;
};

export type ResolvedTenantAccess = {
  tenantId: string;
  status: TenantAccessStatus | 'LEGACY_COMPAT';
  plan: { id: string; key: string; name: string } | null;
  capabilities: ResolvedCapability[];
};

@Injectable()
export class SaasAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCapability(tenantId: string, capabilityKey: string): Promise<ResolvedCapability> {
    const capability = await this.prisma.capability.findUnique({
      where: { key: capabilityKey },
    });

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

    if (!access) {
      return this.legacyCompatibilityValue(capability.key, capability.valueType);
    }

    if (access.status === TenantAccessStatus.SUSPENDED) {
      return this.suspendedValue(capability.key, capability.valueType);
    }

    const override = access.overrides[0];
    const planValue = access.plan?.capabilityValues[0];

    if (capability.valueType === CapabilityValueType.BOOLEAN) {
      if (override && override.enabled !== null) {
        return {
          key: capability.key,
          valueType: capability.valueType,
          enabled: override.enabled,
          limit: null,
          source: 'TENANT_OVERRIDE',
        };
      }

      if (planValue && planValue.enabled !== null) {
        return {
          key: capability.key,
          valueType: capability.valueType,
          enabled: planValue.enabled,
          limit: null,
          source: 'PLAN',
        };
      }

      return {
        key: capability.key,
        valueType: capability.valueType,
        enabled: capability.defaultEnabled,
        limit: null,
        source: 'DEFAULT',
      };
    }

    if (override) {
      return {
        key: capability.key,
        valueType: capability.valueType,
        enabled: null,
        limit: override.limit,
        source: 'TENANT_OVERRIDE',
      };
    }

    if (planValue) {
      return {
        key: capability.key,
        valueType: capability.valueType,
        enabled: null,
        limit: planValue.limit,
        source: 'PLAN',
      };
    }

    return {
      key: capability.key,
      valueType: capability.valueType,
      enabled: null,
      limit: capability.defaultLimit,
      source: 'DEFAULT',
    };
  }

  async resolveTenantAccess(tenantId: string): Promise<ResolvedTenantAccess> {
    const capabilities = await this.prisma.capability.findMany({
      where: { isActive: true },
      orderBy: [{ groupKey: 'asc' }, { position: 'asc' }, { key: 'asc' }],
    });

    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      include: {
        plan: {
          include: {
            capabilityValues: true,
          },
        },
        overrides: true,
      },
    });

    if (!access) {
      return {
        tenantId,
        status: 'LEGACY_COMPAT',
        plan: null,
        capabilities: capabilities.map((capability) =>
          this.legacyCompatibilityValue(capability.key, capability.valueType),
        ),
      };
    }

    const planValues = new Map(access.plan?.capabilityValues.map((value) => [value.capabilityId, value]) || []);
    const overrides = new Map(access.overrides.map((value) => [value.capabilityId, value]));

    const resolved = capabilities.map<ResolvedCapability>((capability) => {
      if (access.status === TenantAccessStatus.SUSPENDED) {
        return this.suspendedValue(capability.key, capability.valueType);
      }

      const override = overrides.get(capability.id);
      const planValue = planValues.get(capability.id);

      if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (override && override.enabled !== null) {
          return {
            key: capability.key,
            valueType: capability.valueType,
            enabled: override.enabled,
            limit: null,
            source: 'TENANT_OVERRIDE',
          };
        }
        if (planValue && planValue.enabled !== null) {
          return {
            key: capability.key,
            valueType: capability.valueType,
            enabled: planValue.enabled,
            limit: null,
            source: 'PLAN',
          };
        }
        return {
          key: capability.key,
          valueType: capability.valueType,
          enabled: capability.defaultEnabled,
          limit: null,
          source: 'DEFAULT',
        };
      }

      if (override) {
        return {
          key: capability.key,
          valueType: capability.valueType,
          enabled: null,
          limit: override.limit,
          source: 'TENANT_OVERRIDE',
        };
      }
      if (planValue) {
        return {
          key: capability.key,
          valueType: capability.valueType,
          enabled: null,
          limit: planValue.limit,
          source: 'PLAN',
        };
      }
      return {
        key: capability.key,
        valueType: capability.valueType,
        enabled: null,
        limit: capability.defaultLimit,
        source: 'DEFAULT',
      };
    });

    return {
      tenantId,
      status: access.status,
      plan: access.plan ? { id: access.plan.id, key: access.plan.key, name: access.plan.name } : null,
      capabilities: resolved,
    };
  }

  private legacyCompatibilityValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: true, limit: null, source: 'LEGACY_COMPAT' };
    }
    return { key, valueType, enabled: null, limit: null, source: 'LEGACY_COMPAT' };
  }

  private suspendedValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: false, limit: null, source: 'SUSPENDED' };
    }
    return { key, valueType, enabled: null, limit: 0, source: 'SUSPENDED' };
  }
}
