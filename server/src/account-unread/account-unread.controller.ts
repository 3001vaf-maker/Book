import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccountGuard } from '../online-booking/account.guard';
import { AccountUnreadService } from './account-unread.service';

type AccountRequest = Request & { accountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking/account')
@UseGuards(AccountGuard)
export class AccountUnreadController {
  constructor(private readonly unread: AccountUnreadService) {}

  @Get('unread-summary')
  summary(@Req() request: AccountRequest) {
    return this.unread.summary(request.accountAuth!.accountId);
  }
}
