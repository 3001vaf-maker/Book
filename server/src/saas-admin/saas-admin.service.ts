import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';
import { TenantInvitationService } from '../tenant-invitation/tenant-invitation.service';
import { DocumentRegistryService } from '../document-registry/document-registry.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';
import { FirstRunService } from '../first-run/first-run.service';
import { PlatformNoticeService } from '../platform-notice/platform-notice.service';

@Injectable()
export class SaasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
    private readonly invitations: TenantInvitationService,
    private readonly documentRegistry: DocumentRegistryService,
    private readonly email: TransactionalEmailService,
    private readonly firstRun: FirstRunService,
    private readonly notices: PlatformNoticeService,
  ) {}

  async me(adminId: string, platformAccountId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      include: { account: { select: { id: true, email: true } } },
    });
    if (!admin || admin.platformAccountId !== platformAccountId) throw new NotFoundException('Администратор не найден');
    return { id: admin.id, account: admin.account };
  }

  documentRegistryHistory() {
    return this.documentRegistry.history();
  }

  syncDocumentRegistry(documents: unknown) {
    return this.documentRegistry.syncCatalog(documents);
  }

  async capabilities() {
    await this.invitations.ensureStarterPlan();
    return this.prisma.capability.findMany({
      where: { isActive: true },
      orderBy: [{ groupKey: 'asc' }, { position: 'asc' }, { key: 'asc' }],
      select: {
        id: true,
        key: true,
        groupKey: true,
        name: true,
        description: true,
        valueType: true,
        defaultEnabled: true,
        defaultLimit: true,
        position: true,
      },
    });
  }

  async tenants() {
    const rows = await this.prisma.tenantAccess.findMany({
      include: {
        plan: { select: { id: true, key: true, name: true } },
        tenant: {
          include: {
            memberships: {
              include: { account: { select: { id: true, email: true, createdAt: true } } },
              orderBy: { createdAt: 'asc' },
            },
            profiles: {
              select: { platformAccountId: true, name: true, surname: true, profession: true },
            },
            tenantInvitations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, email: true, name: true, status: true, createdAt: true, expiresAt: true, activatedAt: true, demoExpiresAt: true, firstRunScenarioVersionId: true },
            },
            firstRunProgress: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { status: true, currentStepKey: true, startedAt: true, completedAt: true, scenarioVersionId: true },
            },
          },
        },
      },
      orderBy: [{ isOwnerBook: 'desc' }, { createdAt: 'asc' }],
    });

    return Promise.all(rows.map(async (row) => {
      const membership = row.tenant.memberships[0] || null;
      const profile = membership
        ? row.tenant.profiles.find((item) => item.platformAccountId === membership.platformAccountId) || null
        : null;
      const invitation = row.tenant.tenantInvitations[0] || null;
      const resolved = await this.access.resolveTenantAccess(row.tenantId);
      return {
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        status: row.status,
        isOwnerBook: row.isOwnerBook,
        plan: row.plan,
        ownerProfile: membership ? {
          platformAccountId: membership.account.id,
          email: membership.account.email,
          name: [profile?.name, profile?.surname].filter(Boolean).join(' ') || invitation?.name || row.tenant.name,
          profession: profile?.profession || '',
          registeredAt: membership.account.createdAt,
        } : null,
        invitation,
        access: resolved,
        firstRun: row.tenant.firstRunProgress[0] || null,
      };
    }));
  }

  async sendTechnicalEmail(tenantId: string, input: { subject?: unknown; body?: unknown }) {
    const subject = String(input?.subject || '').trim();
    const body = String(input?.body || '').trim();
    if (!subject) throw new BadRequestException('Введите тему письма');
    if (!body) throw new BadRequestException('Введите текст письма');
    if (subject.length > 200) throw new BadRequestException('Тема письма слишком длинная');
    if (body.length > 20000) throw new BadRequestException('Текст письма слишком длинный');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        memberships: {
          include: { account: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        profiles: {
          select: { platformAccountId: true, name: true, surname: true },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Профиль не найден');

    const membership = tenant.memberships[0];
    if (!membership) throw new BadRequestException('У профиля ещё нет учётной записи');

    const recipientEmail = String(membership.account.email || '').trim().toLowerCase();
    if (!recipientEmail || !recipientEmail.includes('@')) throw new BadRequestException('У профиля нет корректного email');

    const profile = tenant.profiles.find((item) => item.platformAccountId === membership.platformAccountId);
    const recipientName = [profile?.name, profile?.surname].filter(Boolean).join(' ') || tenant.name;
    const escaped = body.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[char] || char);

    const sent = await this.email.send({
      to: recipientEmail,
      toName: recipientName,
      subject,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escaped}</div>`,
      tag: 'platform-service',
    });

    return {
      recipientEmail,
      recipientName,
      messageId: sent.messageId,
    };
  }

  async updateTenantAccess(tenantId: string, input: {
    status?: unknown;
    capabilities?: unknown;
  }) {
    const tenantAccess = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      include: {
        plan: { include: { capabilityValues: true } },
        overrides: true,
      },
    });
    if (!tenantAccess) throw new NotFoundException('Рабочее пространство не найдено');

    const planValues = new Map(tenantAccess.plan?.capabilityValues.map((item) => [item.capabilityId, item]) || []);
    const overrideValues = new Map(tenantAccess.overrides.map((item) => [item.capabilityId, item]));

    const baseValue = (capability: {
      id: string;
      valueType: CapabilityValueType;
      defaultEnabled: boolean;
      defaultLimit: number | null;
    }) => {
      const planValue = planValues.get(capability.id);
      if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (tenantAccess.isOwnerBook && !tenantAccess.plan) return true;
        if (planValue?.enabled !== null && planValue?.enabled !== undefined) return planValue.enabled;
        return capability.defaultEnabled;
      }
      if (tenantAccess.isOwnerBook && !tenantAccess.plan) return null;
      if (planValue) return planValue.limit;
      return capability.defaultLimit;
    };

    const currentValue = (capability: {
      id: string;
      valueType: CapabilityValueType;
      defaultEnabled: boolean;
      defaultLimit: number | null;
    }) => {
      const override = overrideValues.get(capability.id);
      if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (override?.enabled !== null && override?.enabled !== undefined) return override.enabled;
        return baseValue(capability);
      }
      if (override) return override.limit;
      return baseValue(capability);
    };

    const statusText = String(input?.status || '').trim().toUpperCase();
    if (statusText) {
      if (!Object.values(TenantAccessStatus).includes(statusText as TenantAccessStatus)) {
        throw new BadRequestException('Неизвестный статус рабочего пространства');
      }
      if (statusText !== tenantAccess.status) {
        await this.prisma.tenantAccess.update({
          where: { tenantId },
          data: { status: statusText as TenantAccessStatus },
        });
        await this.prisma.platformActivityEvent.create({
          data: {
            tenantId,
            eventType: 'ACCESS_STATUS_CHANGED',
            metadata: {
              from: tenantAccess.status,
              to: statusText,
            },
          },
        });
        await this.notices.createForTenantOwner(tenantId, {
          type: 'ACCESS_STATUS_CHANGED',
          title: statusText === TenantAccessStatus.SUSPENDED
            ? 'Рабочее пространство временно отключено'
            : 'Рабочее пространство снова доступно',
          body: statusText === TenantAccessStatus.SUSPENDED
            ? 'Администратор временно ограничил доступ к рабочему пространству.'
            : 'Администратор восстановил доступ к рабочему пространству.',
          metadata: { status: statusText },
        });
      }
    }

    const values = Array.isArray(input?.capabilities) ? input.capabilities : [];
    const seenKeys = new Set<string>();
    for (const raw of values) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const value = raw as Record<string, unknown>;
      const key = String(value.key || '').trim();
      if (!key) continue;
      if (seenKeys.has(key)) throw new BadRequestException(`Инструмент ${key} передан несколько раз`);
      seenKeys.add(key);

      const capability = await this.prisma.capability.findUnique({ where: { key } });
      if (!capability || !capability.isActive) throw new BadRequestException(`Неизвестная возможность: ${key}`);
      const before = currentValue(capability);

      if (value.inherit === true) {
        await this.prisma.tenantCapabilityOverride.deleteMany({
          where: { tenantId, capabilityId: capability.id },
        });
        overrideValues.delete(capability.id);
      } else if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (typeof value.enabled !== 'boolean') throw new BadRequestException(`Для ${key} требуется ON/OFF`);
        const saved = await this.prisma.tenantCapabilityOverride.upsert({
          where: { tenantId_capabilityId: { tenantId, capabilityId: capability.id } },
          create: { tenantId, capabilityId: capability.id, enabled: value.enabled, limit: null },
          update: { enabled: value.enabled, limit: null },
        });
        overrideValues.set(capability.id, saved);
      } else {
        const limit = value.limit === null ? null : Number(value.limit);
        if (limit !== null && (!Number.isInteger(limit) || limit < 0)) {
          throw new BadRequestException(`Для ${key} требуется целый лимит или без ограничения`);
        }
        const saved = await this.prisma.tenantCapabilityOverride.upsert({
          where: { tenantId_capabilityId: { tenantId, capabilityId: capability.id } },
          create: { tenantId, capabilityId: capability.id, enabled: null, limit },
          update: { enabled: null, limit },
        });
        overrideValues.set(capability.id, saved);
      }

      const after = currentValue(capability);
      if (before === after) continue;

      const booleanChange = capability.valueType === CapabilityValueType.BOOLEAN;
      const enabled = booleanChange ? after === true : null;
      await this.prisma.platformActivityEvent.create({
        data: {
          tenantId,
          eventType: 'CAPABILITY_CHANGED',
          metadata: {
            key: capability.key,
            name: capability.name,
            valueType: capability.valueType,
            before,
            after,
          },
        },
      });
      await this.notices.createForTenantOwner(tenantId, {
        type: 'CAPABILITY_CHANGED',
        title: booleanChange
          ? (enabled ? `Инструмент «${capability.name}» добавлен` : `Инструмент «${capability.name}» отключён`)
          : `Изменён лимит «${capability.name}»`,
        body: booleanChange
          ? (enabled
            ? 'Администратор добавил этот инструмент в ваш набор. Он станет доступен в соответствии с текущим режимом работы.'
            : 'Администратор отключил этот инструмент в вашем наборе.')
          : `Новое значение лимита: ${after === null ? 'без ограничения' : after}.`,
        metadata: {
          key: capability.key,
          valueType: capability.valueType,
          before,
          after,
        },
      });
    }

    return this.access.resolveTenantAccess(tenantId);
  }

  async deleteTenant(tenantId: string) {
    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      select: {
        tenantId: true,
        isOwnerBook: true,
        tenant: {
          select: {
            memberships: { select: { platformAccountId: true } },
          },
        },
      },
    });
    if (!access) throw new NotFoundException('Рабочее пространство не найдено');
    if (access.isOwnerBook) throw new BadRequestException('OWNER Book нельзя удалить');

    const platformAccountIds = [...new Set(access.tenant.memberships.map((item) => item.platformAccountId))];

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.delete({ where: { id: tenantId } });

      for (const platformAccountId of platformAccountIds) {
        const remainingMemberships = await tx.membership.count({ where: { platformAccountId } });
        const platformAdmin = await tx.platformAdmin.findUnique({
          where: { platformAccountId },
          select: { id: true },
        });
        if (remainingMemberships === 0 && !platformAdmin) {
          await tx.platformAccount.delete({ where: { id: platformAccountId } });
        }
      }
    });

    return { deleted: true, tenantId, platformAccountIds };
  }

  firstRunScenario() {
    return this.firstRun.adminScenario();
  }

  ensureFirstRunDraft() {
    return this.firstRun.ensureAdminDraft();
  }

  updateFirstRunStep(stepKey: string, input: Record<string, unknown>) {
    return this.firstRun.updateDraftStep(stepKey, input);
  }

  reorderFirstRun(stepKeys: unknown) {
    return this.firstRun.reorderDraft(stepKeys);
  }

  publishFirstRun() {
    return this.firstRun.publishDraft();
  }

  firstRunAnalytics() {
    return this.firstRun.adminAnalytics();
  }

  async tenantActivity(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Рабочее пространство не найдено');
    return this.firstRun.adminActivity(tenantId);
  }

  setCommercialMode(tenantId: string, mode: unknown) {
    return this.firstRun.setCommercialMode(tenantId, mode);
  }

  extendDemo(tenantId: string, days: unknown) {
    return this.firstRun.extendDemo(tenantId, days);
  }

  async updateCapabilityOrder(tenantId: string, keysValue: unknown) {
    const keys = (Array.isArray(keysValue) ? keysValue : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    if (!keys.length || new Set(keys).size !== keys.length) {
      throw new BadRequestException('Передайте порядок инструментов без дублей');
    }

    const capabilities = await this.prisma.capability.findMany({
      where: { isActive: true },
      select: { id: true, key: true },
    });
    const byKey = new Map(capabilities.map((item) => [item.key, item]));
    if (keys.length !== capabilities.length || capabilities.some((item) => !keys.includes(item.key))) {
      throw new BadRequestException('Передайте полный порядок доступных инструментов');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantCapabilityOrder.deleteMany({ where: { tenantId } });
      for (const [index, key] of keys.entries()) {
        const capability = byKey.get(key)!;
        await tx.tenantCapabilityOrder.create({
          data: {
            tenantId,
            capabilityId: capability.id,
            position: (index + 1) * 10,
          },
        });
      }
    });

    return this.access.resolveTenantAccess(tenantId);
  }
}
