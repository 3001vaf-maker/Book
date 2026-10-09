import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PersonalAccountFinanceService } from '../finance/personal-account-finance.service';
import { PrismaService } from '../prisma.service';
import {
  listPersonalAccountsWithActivity,
  personalAccountSnapshot,
  updatePersonalAccountSettingsWith,
} from './personal-account-state';

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function isRetryableTransactionError(error: unknown) {
  const code = text(objectValue(error).code);
  return code === 'P2034' || code === '40001';
}

@Injectable()
export class PersonalAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: PersonalAccountFinanceService,
  ) {}

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        lastError = error;
        if (!isRetryableTransactionError(error) || attempt === 2) throw error;
      }
    }
    throw lastError;
  }

  list(tenantId: string) {
    return listPersonalAccountsWithActivity(this.prisma, tenantId);
  }

  get(tenantId: string, personKey: string) {
    return personalAccountSnapshot(this.prisma, tenantId, personKey);
  }

  updateSettings(tenantId: string, personKey: string, body: unknown) {
    return this.serializable((tx) => updatePersonalAccountSettingsWith(tx, tenantId, personKey, body));
  }

  fund(tenantId: string, personKey: string, body: unknown) {
    return this.finance.fund(tenantId, { ...objectValue(body), personKey });
  }

  withdraw(tenantId: string, personKey: string, body: unknown) {
    return this.finance.withdraw(tenantId, { ...objectValue(body), personKey });
  }

  settleDebt(tenantId: string, debtId: string, body: unknown) {
    return this.finance.settleDebt(tenantId, debtId, body);
  }

  async endUserView(tenantId: string, personKey: string) {
    const snapshot = await personalAccountSnapshot(this.prisma, tenantId, personKey);
    return snapshot.visibleToEndUser ? snapshot : null;
  }
}
