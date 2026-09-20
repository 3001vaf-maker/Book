import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type JsonObject = Record<string, any>;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function percent(value: unknown) {
  return Math.max(0, Math.min(100, numberValue(value)));
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  calculatePlan(items: JsonObject[], discountValue: unknown = 0) {
    const discountPercent = percent(discountValue);
    const prepared = items.map((item) => {
      const price = Math.max(0, numberValue(item?.cost ?? item?.price));
      const discountMoney = price * discountPercent / 100;
      return {
        sourceType: String(item?.sourceType || 'procedure'),
        sourceId: String(item?.sourceId || item?.id || ''),
        name: String(item?.name || ''),
        price,
        discountMode: discountPercent > 0 ? 'percent' : 'none',
        discountPercent,
        discountMoney,
        planAmount: Math.max(0, price - discountMoney),
      };
    });
    return {
      items: prepared,
      serviceTotal: prepared.reduce((sum, item) => sum + item.price, 0),
      discountPercent,
      discountTotal: prepared.reduce((sum, item) => sum + item.discountMoney, 0),
      planTotal: prepared.reduce((sum, item) => sum + item.planAmount, 0),
    };
  }

  async recordPaymentState(tenantId: string, recordId: string, plan: JsonObject) {
    const row = await this.prisma.businessAuxiliaryState.findUnique({ where: { tenantId } });
    const finance = objectValue(objectValue(row?.data).finance);
    const movements = [...arrayValue(finance.income), ...arrayValue(finance.expense)]
      .filter((item) => item?.status !== 'cancelled'
        && String(item?.source?.type || '') === 'record'
        && String(item?.source?.id || '') === String(recordId || ''));

    const income = movements
      .filter((item) => item?.movementType === 'income')
      .reduce((sum, item) => sum + Math.max(0, numberValue(item?.serviceAmount ?? item?.total)), 0);
    const expense = movements
      .filter((item) => item?.movementType === 'expense')
      .reduce((sum, item) => sum + Math.max(0, numberValue(item?.serviceAmount ?? item?.total)), 0);
    const paid = Math.max(0, income - expense);
    const total = Math.max(0, numberValue(plan?.planTotal));
    const due = Math.max(0, total - paid);
    return {
      state: due <= 0.009 ? 'paid' : paid > 0.009 ? 'partial' : 'unpaid',
      paid,
      due,
    };
  }
}
