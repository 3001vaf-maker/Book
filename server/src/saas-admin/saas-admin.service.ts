import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';
import { TenantInvitationService } from '../tenant-invitation/tenant-invitation.service';
import { DocumentRegistryService } from '../document-registry/document-registry.service';
import { TransactionalEmailService } from '../transactional-email/transactional-email.service';

@Injectable()
export class SaasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
    private readonly invitations: TenantInvitationService,
    private readonly documentRegistry: DocumentRegistryService,
    private readonly email: TransactionalEmailService,
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
