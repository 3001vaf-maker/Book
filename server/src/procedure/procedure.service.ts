import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

@Injectable()
export class ProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  private assignmentFor(procedure: JsonObject, workplaceId: string) {
    return arrayValue(procedure.workplaces)
      .find((item) => text(item?.workplaceId ?? item?.key ?? item?.id) === workplaceId) || null;
  }

  private costFor(procedure: JsonObject, workplaceId: string) {
    const assignment = this.assignmentFor(procedure, workplaceId);
    const assigned = assignment?.cost;
    const base = procedure?.cost;
    const hasAssigned = assigned && typeof assigned === 'object' && !assigned.free && (
      assigned.amount !== '' && assigned.amount != null
      || assigned.from !== '' && assigned.from != null
      || assigned.to !== '' && assigned.to != null
    );
    const cost = hasAssigned ? assigned : base;
    if (cost == null || cost?.free) return '';
    if (typeof cost === 'number' || typeof cost === 'string') return cost;
    return cost.amount ?? cost.from ?? '';
  }

  async snapshots(tenantId: string, workplaceId: string, procedureIds: string[]) {
    const row = await this.prisma.businessOperationalState.findUnique({ where: { tenantId } });
    const data = objectValue(row?.data);
    const catalog = arrayValue(data.procedures);
    const ids = [...new Set(procedureIds.map(text).filter(Boolean))];
    if (!ids.length) throw new BadRequestException('Выберите хотя бы одну процедуру');

    return ids.map((id) => {
      const procedure = catalog.find((item) => text(item?.id) === id);
      if (!procedure || !this.assignmentFor(procedure, workplaceId)) {
        throw new BadRequestException('Одна из процедур недоступна в этом рабочем пространстве');
      }
      return {
        id,
        name: text(procedure?.name),
        duration: Math.max(0, Number(procedure?.duration || 0)),
        cost: this.costFor(procedure, workplaceId),
      };
    });
  }
}
