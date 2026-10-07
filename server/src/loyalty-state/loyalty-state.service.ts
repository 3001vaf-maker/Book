import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function json(value: unknown): Prisma.InputJsonValue {
  return clone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class LoyaltyStateService {
  constructor(private readonly prisma: PrismaService) {}

  private async stateRow(tenantId: string) {
    return this.prisma.businessOperationalState.upsert({
      where: { tenantId },
      create: { tenantId, data: json({ loyalty: {} }) },
      update: {},
    });
  }

  async get(tenantId: string) {
    const row = await this.stateRow(tenantId);
    return clone(objectValue(objectValue(row.data).loyalty));
  }

  async update(tenantId: string, body: unknown) {
    const source = objectValue(body);
    const nextLoyalty = clone(objectValue(source.value ?? source));
    const row = await this.stateRow(tenantId);
    const current = clone(objectValue(row.data));
    current.loyalty = nextLoyalty;
    await this.prisma.businessOperationalState.update({
      where: { tenantId },
      data: { data: json(current) },
    });
    return clone(nextLoyalty);
  }
}
