import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CapabilityAccessChangeType, CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from '../saas-access/saas-access.service';
import { MasterInvitationService } from '../master-invitation/master-invitation.service';

type ValidatedCapabilityUpdate = {
  key: string;
  capabilityId: string;
  valueType: CapabilityValueType;
  defaultEnabled: boolean;
  inherit: boolean;
  enabled: boolean | null;
  limit: number | null;
};

type CapabilityStateChange = {
  capabilityId: string;
  changeType: CapabilityAccessChangeType;
};

@Injectable()
export class SaasAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SaasAccessService,
    private readonly invitations: MasterInvitationService,
  ) {}

  async me(adminId: string, userId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!admin || admin.userId !== userId) throw new NotFoundException('Администратор не найден');
    return { id: admin.id, user: admin.user };
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

  async masters() {
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
            masterInvitations: {
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
      const invitation = row.tenant.masterInvitations[0] || null;
      const legalAcceptances = membership
        ? await this.prisma.$queryRaw<Array<{
            id: string;
            documentKey: string;
            title: string;
            documentVersion: number;
            action: string;
            source: string;
            occurredAt: Date;
            requiredForRegistration: boolean;
          }>>`
            SELECT
              e."id",
              d."key" AS "documentKey",
              d."title",
              v."version" AS "documentVersion",
              e."action",
              e."source",
              e."occurredAt",
              d."requiredForRegistration"
            FROM "LegalAcceptanceEvent" e
            JOIN "LegalDocumentVersion" v ON v."id" = e."documentVersionId"
            JOIN "LegalDocument" d ON d."id" = v."documentId"
            WHERE e."tenantId" = ${row.tenantId}
              AND e."userId" = ${membership.userId}
            ORDER BY e."occurredAt" ASC, e."id" ASC
          `
        : [];
      const resolved = await this.access.resolveTenantAccess(row.tenantId);
      return {
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        status: row.status,
        isOwnerBook: row.isOwnerBook,
        plan: row.plan,
        master: membership ? {
          userId: membership.user.id,
          email: membership.user.email,
          name: [profile?.name, profile?.surname].filter(Boolean).join(' ') || invitation?.name || row.tenant.name,
          profession: profile?.profession || '',
          registeredAt: membership.user.createdAt,
        } : null,
        invitation,
        legalAcceptances,
        access: resolved,
      };
    }));
  }

  private async validateCapabilityUpdates(rawValues: unknown[]): Promise<ValidatedCapabilityUpdate[]> {
    const updates: ValidatedCapabilityUpdate[] = [];

    for (const raw of rawValues) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const value = raw as Record<string, unknown>;
      const key = String(value.key || '').trim();
      if (!key) continue;
      const capability = await this.prisma.capability.findUnique({ where: { key } });
      if (!capability || !capability.isActive) throw new BadRequestException(`Неизвестная возможность: ${key}`);

      if (value.inherit === true) {
        updates.push({
          key,
          capabilityId: capability.id,
          valueType: capability.valueType,
          defaultEnabled: capability.defaultEnabled,
          inherit: true,
          enabled: null,
          limit: null,
        });
        continue;
      }

      if (capability.valueType === CapabilityValueType.BOOLEAN) {
        if (typeof value.enabled !== 'boolean') throw new BadRequestException(`Для ${key} требуется ON/OFF`);
        updates.push({
          key,
          capabilityId: capability.id,
          valueType: capability.valueType,
          defaultEnabled: capability.defaultEnabled,
          inherit: false,
          enabled: value.enabled,
          limit: null,
        });
        continue;
      }

      const limit = value.limit === null ? null : Number(value.limit);
      if (limit !== null && (!Number.isInteger(limit) || limit < 0)) {
        throw new BadRequestException(`Для ${key} требуется целый лимит или без ограничения`);
      }
      updates.push({
        key,
        capabilityId: capability.id,
        valueType: capability.valueType,
        defaultEnabled: capability.defaultEnabled,
        inherit: false,
        enabled: null,
        limit,
      });
    }

    return updates;
  }

  private async inheritedBooleanValue(tenantId: string, update: ValidatedCapabilityUpdate) {
    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId },
      include: {
        plan: {
          include: {
            capabilityValues: {
              where: { capabilityId: update.capabilityId },
              take: 1,
            },
          },
        },
      },
    });
    if (!access || access.status !== TenantAccessStatus.ACTIVE) return false;
    if (access.isOwnerBook && !access.plan) return true;
    const planValue = access.plan?.capabilityValues[0];
    if (planValue && planValue.enabled !== null) return planValue.enabled;
    return update.defaultEnabled;
  }

  private async capabilityStateChanges(tenantId: string, updates: ValidatedCapabilityUpdate[]) {
    const before = await this.access.resolveTenantAccess(tenantId);
    const beforeMap = new Map(before.capabilities.map((item) => [item.key, item]));
    const changes: CapabilityStateChange[] = [];

    for (const update of updates) {
      if (update.valueType !== CapabilityValueType.BOOLEAN) continue;
      const previous = beforeMap.get(update.key)?.enabled;
      const next = update.inherit
        ? await this.inheritedBooleanValue(tenantId, update)
        : update.enabled;
      if (typeof next !== 'boolean' || previous === next) continue;
      changes.push({
        capabilityId: update.capabilityId,
        changeType: next ? CapabilityAccessChangeType.ENABLED : CapabilityAccessChangeType.DISABLED,
      });
    }

    return changes;
  }

  async updateTenantAccess(tenantId: string, input: {
    status?: unknown;
    capabilities?: unknown;
  }) {
    const tenantAccess = await this.prisma.tenantAccess.findUnique({ where: { tenantId } });
    if (!tenantAccess) throw new NotFoundException('Book не найден');

    const statusText = String(input?.status || '').trim().toUpperCase();
    let nextStatus: TenantAccessStatus | null = null;
    if (statusText) {
      if (!Object.values(TenantAccessStatus).includes(statusText as TenantAccessStatus)) {
        throw new BadRequestException('Неизвестный статус Book');
      }
      nextStatus = statusText as TenantAccessStatus;
    }

    const rawValues = Array.isArray(input?.capabilities) ? input.capabilities : [];
    const updates = await this.validateCapabilityUpdates(rawValues);
    const stateChanges = await this.capabilityStateChanges(tenantId, updates);
    const batchId = stateChanges.length ? randomUUID() : '';
    const changedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (nextStatus) {
        await tx.tenantAccess.update({
          where: { tenantId },
          data: { status: nextStatus },
        });
      }

      for (const update of updates) {
        if (update.inherit) {
          await tx.tenantCapabilityOverride.deleteMany({
            where: { tenantId, capabilityId: update.capabilityId },
          });
          continue;
        }

        await tx.tenantCapabilityOverride.upsert({
          where: { tenantId_capabilityId: { tenantId, capabilityId: update.capabilityId } },
          create: {
            tenantId,
            capabilityId: update.capabilityId,
            enabled: update.valueType === CapabilityValueType.BOOLEAN ? update.enabled : null,
            limit: update.valueType === CapabilityValueType.LIMIT ? update.limit : null,
          },
          update: {
            enabled: update.valueType === CapabilityValueType.BOOLEAN ? update.enabled : null,
            limit: update.valueType === CapabilityValueType.LIMIT ? update.limit : null,
          },
        });
      }

      for (const change of stateChanges) {
        await tx.capabilityAccessEvent.updateMany({
          where: {
            tenantId,
            capabilityId: change.capabilityId,
            cancelledAt: null,
            OR: [
              { summaryAcknowledgedAt: null },
              {
                changeType: CapabilityAccessChangeType.ENABLED,
                detailAcknowledgedAt: null,
              },
            ],
          },
          data: { cancelledAt: changedAt },
        });
        await tx.capabilityAccessEvent.create({
          data: {
            tenantId,
            capabilityId: change.capabilityId,
            batchId,
            changeType: change.changeType,
          },
        });
      }
    });

    return this.access.resolveTenantAccess(tenantId);
  }
}
