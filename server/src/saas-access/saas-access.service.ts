import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PlatformNoticeService } from '../platform-notice/platform-notice.service';

const DEMO_DAYS = 14;

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + Math.max(0, days) * 24 * 60 * 60 * 1000);
}

type ResolutionSource = 'TENANT_OVERRIDE' | 'PLAN' | 'DEFAULT' | 'OWNER' | 'SUSPENDED' | 'DEMO' | 'DEMO_EXPIRED';

export type ResolvedCapability = {
  key: string;
  valueType: CapabilityValueType;
  enabled: boolean | null;
  limit: number | null;
  source: ResolutionSource;
};

export type ResolvedTenantAccess = {
  tenantId: string;
  status: TenantAccessStatus;
  isOwnerBook: boolean;
  commercialMode: string;
  demoActivatedAt: string;
  demoExpiresAt: string;
  liveRequestedAt: string;
  liveApprovedAt: string;
  plan: { id: string; key: string; name: string } | null;
  capabilityOrder: string[];
  capabilities: ResolvedCapability[];
};

@Injectable()
export class SaasAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notices: PlatformNoticeService,
  ) {}

  async activateDemo(tenantId: string, platformAccountId: string): Promise<ResolvedTenantAccess> {
    const current = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!current) throw new NotFoundException('Состояние рабочего пространства не настроено');
    if (current.commercialMode !== 'DEMO') return this.resolveTenantAccess(tenantId);
    if (current.demoActivatedAt && current.demoExpiresAt) return this.resolveTenantAccess(tenantId);

    const now = new Date();
    const demoExpiresAt = new Date(now.getTime() + DEMO_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantAccess.update({
        where: { tenantId },
        data: { demoActivatedAt: now, demoExpiresAt },
      });
      await tx.tenantInvitation.updateMany({
        where: { tenantId },
        data: { activatedAt: now, demoExpiresAt },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          platformAccountId,
          eventType: 'DEMO_ACTIVATED',
          metadata: { demoDays: DEMO_DAYS, source: 'APP_OPENED' },
          occurredAt: now,
        },
      });
    });

    return this.resolveTenantAccess(tenantId);
  }

  async requestLive(tenantId: string, platformAccountId: string) {
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');
    if (access.commercialMode === 'LIVE' && (access.isOwnerBook || access.liveApprovedAt)) {
      return { requested: false, alreadyLive: true };
    }
    if (access.liveRequestedAt) {
      return { requested: true, duplicate: true, occurredAt: access.liveRequestedAt.toISOString() };
    }

    const now = new Date();
    const event = await this.prisma.$transaction(async (tx) => {
      const current = await tx.tenantAccess.findUnique({ where: { tenantId } });
      if (!current) throw new NotFoundException('Рабочее пространство не найдено');
      if (current.liveRequestedAt) {
        return { occurredAt: current.liveRequestedAt, duplicate: true };
      }
      await tx.tenantAccess.update({
        where: { tenantId },
        data: { liveRequestedAt: now, liveRequestedByPlatformAccountId: platformAccountId },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          platformAccountId,
          eventType: 'LIVE_REQUESTED',
          metadata: { commercialMode: current.commercialMode },
          occurredAt: now,
        },
      });
      return { occurredAt: now, duplicate: false };
    });

    if (!event.duplicate) {
      const [profile, account] = await Promise.all([
        this.prisma.profile.findUnique({
          where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
          select: { name: true, surname: true },
        }),
        this.prisma.platformAccount.findUnique({
          where: { id: platformAccountId },
          select: { email: true },
        }),
      ]);
      const requester = [profile?.name, profile?.surname].filter(Boolean).join(' ') || account?.email || 'Пользователь';
      await this.notices.createForPlatformAdmins({
        type: 'LIVE_REQUESTED',
        title: 'Запрос LIVE',
        body: `${requester} запросил переход в LIVE.`,
        metadata: { tenantId, platformAccountId, occurredAt: event.occurredAt.toISOString() },
      });
    }

    return {
      requested: true,
      duplicate: event.duplicate || undefined,
      occurredAt: event.occurredAt.toISOString(),
    };
  }

  async assertRealOperationsAllowed(tenantId: string) {
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) throw new NotFoundException('Состояние рабочего пространства не настроено');
    if (access.status !== 'ACTIVE') throw new ForbiddenException('Рабочее пространство временно недоступно');
    if (access.commercialMode !== 'LIVE') {
      throw new ForbiddenException('Реальные внешние действия доступны после перехода в LIVE');
    }
    if (!access.isOwnerBook && !access.liveApprovedAt) {
      throw new ForbiddenException('LIVE доступен после подтверждения администратором');
    }
    return true;
  }

  async setCommercialMode(tenantId: string, modeValue: unknown, platformAdminId = '') {
    const mode = String(modeValue || '').trim().toUpperCase();
    if (!['DEMO', 'LIVE'].includes(mode)) throw new BadRequestException('Неизвестный режим');
    const approvedByAdminId = String(platformAdminId || '').trim();
    if (mode === 'LIVE' && !approvedByAdminId) {
      throw new BadRequestException('LIVE требует явного подтверждения администратора');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.tenantAccess.findUnique({ where: { tenantId } });
      if (!current) throw new NotFoundException('Рабочее пространство не найдено');
      if (current.isOwnerBook && mode === 'LIVE' && current.commercialMode === 'LIVE') {
        return { access: current, previousMode: current.commercialMode };
      }
      if (mode === 'LIVE' && current.commercialMode === 'LIVE' && current.liveApprovedAt && current.liveApprovedByAdminId) {
        return { access: current, previousMode: current.commercialMode };
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
            liveRequestedAt: null,
            liveRequestedByPlatformAccountId: null,
            liveApprovedAt: null,
            liveApprovedByAdminId: null,
          },
      });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'COMMERCIAL_MODE_CHANGED',
          metadata: { from: current.commercialMode, commercialMode: mode, approvedByAdminId: mode === 'LIVE' ? approvedByAdminId : '' },
          occurredAt: now,
        },
      });
      if (mode === 'LIVE') {
        await tx.platformActivityEvent.create({
          data: {
            tenantId,
            eventType: 'LIVE_APPROVED_BY_ADMIN',
            metadata: {
              platformAdminId: approvedByAdminId,
              requestedAt: current.liveRequestedAt?.toISOString() || '',
              requestedByPlatformAccountId: current.liveRequestedByPlatformAccountId || '',
            },
            occurredAt: now,
          },
        });
      }
      return { access: updated, previousMode: current.commercialMode };
    });

    if (mode === 'LIVE' && result.previousMode !== 'LIVE') {
      await this.cleanupDemoOperationalData(tenantId);
    }

    const access = result.access;
    return {
      commercialMode: access.commercialMode,
      demoActivatedAt: access.demoActivatedAt?.toISOString() || '',
      demoExpiresAt: access.demoExpiresAt?.toISOString() || '',
      liveRequestedAt: access.liveRequestedAt?.toISOString() || '',
      liveRequestedByPlatformAccountId: access.liveRequestedByPlatformAccountId || '',
      liveApprovedAt: access.liveApprovedAt?.toISOString() || '',
      liveApprovedByAdminId: access.liveApprovedByAdminId || '',
    };
  }

  async extendDemo(tenantId: string, daysValue: unknown = DEMO_DAYS) {
    const days = Math.min(90, Math.max(1, Number(daysValue) || DEMO_DAYS));
    const access = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');
    const base = access.demoExpiresAt && access.demoExpiresAt.getTime() > Date.now() ? access.demoExpiresAt : new Date();
    const expiresAt = addDays(base, days);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.tenantAccess.update({
        where: { tenantId },
        data: { demoExpiresAt: expiresAt, demoExtendedAt: now },
      });
      await tx.tenantInvitation.updateMany({ where: { tenantId }, data: { demoExpiresAt: expiresAt } });
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'DEMO_EXTENDED',
          metadata: { days, expiresAt: expiresAt.toISOString() },
          occurredAt: now,
        },
      });
    });
    return { expiresAt: expiresAt.toISOString(), days };
  }

  private async cleanupDemoOperationalData(tenantId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.financeSettlement.deleteMany({ where: { tenantId } });
      await tx.financeOperation.deleteMany({ where: { tenantId } });
      await tx.recordEvent.deleteMany({ where: { tenantId } });
      await tx.record.deleteMany({ where: { tenantId } });
      await tx.person.deleteMany({ where: { tenantId } });
      await tx.bookingRequest.deleteMany({ where: { tenantId } });
      await tx.ueiState.updateMany({
        where: { tenantId },
        data: { data: { entities: {}, relations: {}, revoked: [] } },
      });
      await tx.$executeRaw`DELETE FROM "NotificationDelivery" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "Notification" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationMessage" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationIdentity" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationPreference" WHERE "tenantId" = ${tenantId}`;
      await tx.$executeRaw`DELETE FROM "CommunicationBroadcastRun" WHERE "tenantId" = ${tenantId}`;
      await tx.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'DEMO_OPERATIONAL_DATA_CLEARED',
          metadata: { reason: 'LIVE_ACTIVATED' },
          occurredAt: new Date(),
        },
      });
    });
  }

  async resolveCapability(tenantId: string, capabilityKey: string): Promise<ResolvedCapability> {
    const capability = await this.prisma.capability.findUnique({
      where: { key: capabilityKey },
    });

    if (!capability || !capability.isActive) {
      throw new NotFoundException(`Неизвестная возможность: ${capabilityKey}`);
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
      throw new NotFoundException('Состояние рабочего пространства не настроено');
    }

    if (access.status === TenantAccessStatus.SUSPENDED) {
      return this.suspendedValue(capability.key, capability.valueType);
    }

    if (this.demoActive(access)) return this.demoValue(capability.key, capability.valueType);
    if (this.demoExpired(access)) return this.demoExpiredValue(capability.key, capability.valueType);
    if (this.liveUnapproved(access)) return this.demoExpiredValue(capability.key, capability.valueType);

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

      if (access.isOwnerBook && !access.plan) {
        return this.ownerValue(capability.key, capability.valueType);
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

    if (access.isOwnerBook && !access.plan) {
      return this.ownerValue(capability.key, capability.valueType);
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
        capabilityOrder: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!access) {
      throw new NotFoundException('Состояние рабочего пространства не настроено');
    }

    const planValues = new Map(access.plan?.capabilityValues.map((value) => [value.capabilityId, value]) || []);
    const overrides = new Map(access.overrides.map((value) => [value.capabilityId, value]));
    const customOrder = new Map(access.capabilityOrder.map((value, index) => [value.capabilityId, index]));

    capabilities.sort((left, right) => {
      const leftOrder = customOrder.get(left.id);
      const rightOrder = customOrder.get(right.id);
      if (leftOrder != null && rightOrder != null) return leftOrder - rightOrder;
      if (leftOrder != null) return -1;
      if (rightOrder != null) return 1;
      return left.position - right.position || left.key.localeCompare(right.key);
    });

    const resolved = capabilities.map<ResolvedCapability>((capability) => {
      if (access.status === TenantAccessStatus.SUSPENDED) {
        return this.suspendedValue(capability.key, capability.valueType);
      }
      if (this.demoActive(access)) return this.demoValue(capability.key, capability.valueType);
      if (this.demoExpired(access)) return this.demoExpiredValue(capability.key, capability.valueType);

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
        if (access.isOwnerBook && !access.plan) {
          return this.ownerValue(capability.key, capability.valueType);
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
      if (access.isOwnerBook && !access.plan) {
        return this.ownerValue(capability.key, capability.valueType);
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
      isOwnerBook: access.isOwnerBook,
      commercialMode: access.commercialMode,
      demoActivatedAt: access.demoActivatedAt?.toISOString() || '',
      demoExpiresAt: access.demoExpiresAt?.toISOString() || '',
      liveRequestedAt: access.liveRequestedAt?.toISOString() || '',
      liveApprovedAt: access.liveApprovedAt?.toISOString() || '',
      plan: access.plan ? { id: access.plan.id, key: access.plan.key, name: access.plan.name } : null,
      capabilityOrder: capabilities.map((capability) => capability.key),
      capabilities: resolved,
    };
  }

  private liveUnapproved(access: { commercialMode: string; isOwnerBook: boolean; liveApprovedAt: Date | null }) {
    return access.commercialMode === 'LIVE'
      && !access.isOwnerBook
      && !access.liveApprovedAt;
  }

  private demoActive(access: { commercialMode: string; demoActivatedAt: Date | null; demoExpiresAt: Date | null }) {
    return access.commercialMode === 'DEMO'
      && (!access.demoExpiresAt || access.demoExpiresAt.getTime() > Date.now());
  }

  private demoExpired(access: { commercialMode: string; demoActivatedAt: Date | null; demoExpiresAt: Date | null }) {
    return access.commercialMode === 'DEMO'
      && Boolean(access.demoExpiresAt)
      && access.demoExpiresAt!.getTime() <= Date.now();
  }

  private demoValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: true, limit: null, source: 'DEMO' };
    }
    return { key, valueType, enabled: null, limit: null, source: 'DEMO' };
  }

  private demoExpiredValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: false, limit: null, source: 'DEMO_EXPIRED' };
    }
    return { key, valueType, enabled: null, limit: 0, source: 'DEMO_EXPIRED' };
  }

  private ownerValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: true, limit: null, source: 'OWNER' };
    }
    return { key, valueType, enabled: null, limit: null, source: 'OWNER' };
  }

  private suspendedValue(key: string, valueType: CapabilityValueType): ResolvedCapability {
    if (valueType === CapabilityValueType.BOOLEAN) {
      return { key, valueType, enabled: false, limit: null, source: 'SUSPENDED' };
    }
    return { key, valueType, enabled: null, limit: 0, source: 'SUSPENDED' };
  }
}
