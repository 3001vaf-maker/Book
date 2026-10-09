import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessStateService } from '../business-state/business-state.service';
import { PersonalAccountService } from '../loyalty/personal-account.service';
import { PrismaService } from '../prisma.service';
import { AccountGuard } from './account.guard';

type AccountRequest = Request & {
  accountAuth?: { accountId: string; tenantId: string };
};

@Controller('online-booking/account/personal-accounts')
@UseGuards(AccountGuard)
export class AccountPersonalAccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessState: BusinessStateService,
    private readonly personalAccounts: PersonalAccountService,
  ) {}

  @Get()
  async list(@Req() request: AccountRequest) {
    const accountId = String(request.accountAuth?.accountId || '').trim();
    const links = await this.prisma.accountTenantLink.findMany({
      where: { accountId },
      select: { tenantId: true },
      orderBy: { updatedAt: 'desc' },
    });

    const rows = await Promise.all(links.map(async ({ tenantId }) => {
      const identity = await this.businessState.bookingIdentityForAccount(tenantId, accountId);
      const person = identity?.person && typeof identity.person === 'object' && !Array.isArray(identity.person)
        ? identity.person as Record<string, unknown>
        : {};
      const personId = String(person.key ?? person.id ?? '').trim();
      if (!personId) return null;
      const snapshot = await this.personalAccounts.endUserView(tenantId, personId);
      return snapshot ? { tenantId, ...snapshot } : null;
    }));

    return rows.filter(Boolean);
  }
}
