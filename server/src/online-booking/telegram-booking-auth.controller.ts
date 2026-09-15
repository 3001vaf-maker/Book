import { Body, Controller, Param, Post } from '@nestjs/common';
import { ClientCardLinkService } from './client-card-link.service';
import { TelegramBookingAuthService } from './telegram-booking-auth.service';

@Controller('online-booking')
export class TelegramBookingAuthController {
  constructor(
    private readonly telegramAuth: TelegramBookingAuthService,
    private readonly clientCards: ClientCardLinkService,
  ) {}

  @Post(':tenantId/account/telegram-entry/exchange')
  exchange(
    @Param('tenantId') tenantId: string,
    @Body() body: { token?: unknown },
  ) {
    return this.telegramAuth.exchange(tenantId, body?.token);
  }

  @Post(':tenantId/account/telegram-entry/register')
  async register(
    @Param('tenantId') tenantId: string,
    @Body() body: { token?: unknown; account?: Record<string, any> },
  ) {
    const account = body?.account && typeof body.account === 'object' ? body.account : {};
    await this.clientCards.validateNewAccountContacts(tenantId, account);
    return this.telegramAuth.register(tenantId, body?.token, account);
  }
}
