import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessStateService } from '../business-state/business-state.service';
import { loyaltyForPerson } from '../loyalty/bonus-ledger';
import { PrismaService } from '../prisma.service';
import { AccountGuard } from './account.guard';

type AccountRequest = Request & { accountAuth?: { accountId: string; tenantId: string } };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

@Controller('online-booking')
export class AccountLoyaltyController {
  constructor(
    private readonly business: BusinessStateService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/loyalty')
  async loyalty(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
  ) {
    const scopeTenantId = text(tenantId);
    const accountId = text(request.accountAuth?.accountId);
    if (!scopeTenantId || !accountId) return { accounts: [], operations: [], assignments: [], instances: [], programs: [] };
    const identity = await this.business.bookingIdentityForAccount(scopeTenantId, accountId);
    const members = Array.isArray(identity?.memberPeople) ? identity.memberPeople : [];
    const keys = members
      .map((value) => text(objectValue(value).key))
      .filter(Boolean);
    if (!keys.length && identity?.person) {
      const key = text(objectValue(identity.person).key);
      if (key) keys.push(key);
    }
    if (!keys.length) return { accounts: [], operations: [], assignments: [], instances: [], programs: [] };
    return loyaltyForPerson(this.prisma, scopeTenantId, keys);
  }
}
