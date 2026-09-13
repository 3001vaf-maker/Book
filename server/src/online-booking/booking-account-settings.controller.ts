import { Body, Controller, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BookingAccountGuard } from './booking-account.guard';
import { OnlineBookingService } from './online-booking.service';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class BookingAccountSettingsController {
  constructor(private readonly booking: OnlineBookingService) {}

  @UseGuards(BookingAccountGuard)
  @Put(':tenantId/account/password')
  changePassword(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { currentPassword?: unknown; newPassword?: unknown },
  ) {
    return this.booking.changeAccountPassword(
      tenantId,
      request.bookingAccountAuth!.accountId,
      body?.currentPassword,
      body?.newPassword,
    );
  }
}
