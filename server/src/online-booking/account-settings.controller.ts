import { Body, Controller, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccountGuard } from './account.guard';
import { OnlineBookingService } from './online-booking.service';

type AccountRequest = Request & { accountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class AccountSettingsController {
  constructor(private readonly booking: OnlineBookingService) {}

  @UseGuards(AccountGuard)
  @Put(':tenantId/account/password')
  changePassword(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { currentPassword?: unknown; newPassword?: unknown },
  ) {
    return this.booking.changeAccountPassword(
      tenantId,
      request.accountAuth!.accountId,
      body?.currentPassword,
      body?.newPassword,
    );
  }
}
