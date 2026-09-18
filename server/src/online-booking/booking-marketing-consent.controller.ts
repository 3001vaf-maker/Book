import { BadRequestException, Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CommunicationService } from '../communication/communication.service';
import { MarketingConsentService } from '../legal-runtime/marketing-consent.service';
import { BookingAccountGuard } from './booking-account.guard';
import { OnlineBookingService } from './online-booking.service';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking/:tenantId/account/marketing-consent')
@UseGuards(BookingAccountGuard)
export class BookingMarketingConsentController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly communications: CommunicationService,
    private readonly marketing: MarketingConsentService,
  ) {}

  private async telegramUserId(tenantId: string, accountId: string) {
    const account = await this.booking.getAccount(tenantId, accountId);
    const identity = await this.communications.telegramIdentity(tenantId, { phone: account.phone, uei: account.uei });
    const telegramUserId = String(identity?.externalUserId || '').trim();
    if (!telegramUserId) throw new BadRequestException('Telegram не привязан');
    return telegramUserId;
  }

  @Get()
  async state(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    const telegramUserId = await this.telegramUserId(tenantId, request.bookingAccountAuth!.accountId);
    return this.marketing.state(tenantId, telegramUserId);
  }

  @Put()
  async update(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { enabled?: unknown },
  ) {
    if (body?.enabled !== true && body?.enabled !== false) throw new BadRequestException('Укажите enabled=true/false');
    const telegramUserId = await this.telegramUserId(tenantId, request.bookingAccountAuth!.accountId);
    return this.marketing.set(tenantId, telegramUserId, body.enabled, 'client-marketing-settings');
  }
}
