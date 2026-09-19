import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';
import { InvitationService } from '../invitation/invitation.service';
import { DocumentRegistryService } from '../document-registry/document-registry.service';

@Injectable()
export class SaasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
    private readonly invitations: InvitationService,
    private readonly documentRegistry: DocumentRegistryService,
  ) {}

  async me(adminId: string, userId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!admin || admin.userId !== userId) throw new NotFoundException('Администратор не найден');
    return { id: admin.id, user: admin.user };
  }

  documentRegistryHistory() {
    return this.documentRegistry.history();
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

  async profiles() {
    const rows = await this.prisma.tenantAccess.findMany({
      include: {
        plan: { select: { id: true, key: true, name: true } },
        tenant: {
          include: {
            memberships: {
              include: { user: { select: { id: true, email: true, createdAt: true } } },
              orderBy: { createdAt: 'asc' },
            },
            profiles: {
              select: { userId: true, name: true, surname: true, profession: true },
            },
            invitations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, email: true, name: true, status: true, createdAt: true, expiresAt: true },
            },
          },
        },
      },
      orderBy: [{ isOwnerBook: 'desc' }, { createdAt: 'asc' }],
    });

    return Promise.all(rows.map(async (row) => {
      const membership = row.tenant.memberships[0] || null;
      const profile = membership
        ? row.tenant.profiles.find((item) => item.userId === membership.userId) || null
        : null;
      const invitation = row.tenant.invitations[0] || null;
      const resolved = await this.access.resolveTenantAccess(row.tenantId);
      return {
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        status: row.status,
        isOwnerBook: row.isOwnerBook,
        plan: row.plan,
        profile: membership ? {
          userId: membership.user.id,
          email: membership.user.email,
          name: [profile?.name, profile?.surname].filter(Boolean).join(' ') || invitation?.name || row.tenant.name,
          profession: profile?.profession || '',
          registeredAt: membership.user.createdAt,
        } : null,
        invitation,
        access: resolved,
      };
    }));
  }

  async updateTenantAccess(tenantId: string, input: {
    status?: unknown;
    capabilities?: unknown;
  }) {
    const tenantAccess = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!tenantAccess) throw new NotFoundException('Book не найден');

    const statusText = String(input?.status || '').trim().toUpperCase();
    if (statusText) {
      if (!Object.values(TenantAccessStatus).includes(statusText as TenantAccessStatus)) {
        throw new BadRequestException('Неизвестный статус Book');
      }
      await this.prisma.tenantAccess.update({
        where: { tenantId },
        data: { status: statusText as TenantAccessStatus },
      });
    }

    const values = Array.isArray(input?.capabilities) ? input.capabilities : [];
    for (const raw of values) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const value = raw as Record<string, unknown>;
      const key = String(value.key || '').trim();
      if (!key) continue;
      const capability = await this.prisma.capability.findUnique({ where: { key } });
      if (!capability || !capability.isActive) throw new BadRequestException(`Неизвестная возможность: ${key}`);

      if (value.inherit === true) {
        await this.prisma.tenantCapabilityOverride.deleteMany({
          where: { tenantId, capabilityId: capability.id },
        });
        continue;
      }

      if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (typeof value.enabled !== 'boolean') throw new BadRequestException(`Для ${key} требуется ON/OFF`);
        await this.prisma.tenantCapabilityOverride.upsert({
          where: { tenantId_capabilityId: { tenantId, capabilityId: capability.id } },
          create: { tenantId, capabilityId: capability.id, enabled: value.enabled, limit: null },
          update: { enabled: value.enabled, limit: null },
        });
        continue;
      }

      const limit = value.limit === null ? null : Number(value.limit);
      if (limit !== null && (!Number.isInteger(limit) || limit < 0)) {
        throw new BadRequestException(`Для ${key} требуется целый лимит или без ограничения`);
      }
      await this.prisma.tenantCapabilityOverride.upsert({
        where: { tenantId_capabilityId: { tenantId, capabilityId: capability.id } },
        create: { tenantId, capabilityId: capability.id, enabled: null, limit },
        update: { enabled: null, limit },
      });
    }

    return this.access.resolveTenantAccess(tenantId);
  }
}
