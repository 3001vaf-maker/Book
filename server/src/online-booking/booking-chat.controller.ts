import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CommunicationService } from '../communication/communication.service';
import { BookingAccountGuard } from './booking-account.guard';
import { OnlineBookingService } from './online-booking.service';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking/:tenantId/account/internal-chat')
@UseGuards(BookingAccountGuard)
export class BookingChatController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly communications: CommunicationService,
  ) {}

  private accountId(request: AccountRequest, tenantId: string) {
    const auth = request.bookingAccountAuth!;
    if (auth.tenantId !== tenantId) throw new BadRequestException('Аккаунт относится к другому Book');
    return auth.accountId;
  }

  @Get()
  async thread(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    const accountId = this.accountId(request, tenantId);
    const account = await this.booking.getAccount(tenantId, accountId);
    return this.communications.listThread(tenantId, { bookingAccountId: accountId, phone: account.phone, uei: account.uei }, 500);
  }

  @Post('messages')
  async send(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { body?: unknown; content?: unknown; attachments?: unknown },
  ) {
    const accountId = this.accountId(request, tenantId);
    const account = await this.booking.getAccount(tenantId, accountId);
    return this.communications.recordMessage(tenantId, {
      bookingAccountId: accountId,
      phone: account.phone,
      uei: account.uei,
      direction: 'inbound',
      kind: Array.isArray(body?.attachments) && body.attachments.length ? 'media' : 'message',
      channel: 'IN_APP',
      body: body?.body,
      content: body?.content,
      attachments: body?.attachments,
      status: 'delivered',
    });
  }

  @Patch('messages/:messageId')
  edit(
    @Param('tenantId') tenantId: string,
    @Param('messageId') messageId: string,
    @Req() request: AccountRequest,
    @Body() body: { body?: unknown; content?: unknown },
  ) {
    const accountId = this.accountId(request, tenantId);
    return this.communications.editMessage(tenantId, messageId, { side: 'client', accountId }, body || {});
  }

  @Delete('messages/:messageId')
  remove(@Param('tenantId') tenantId: string, @Param('messageId') messageId: string, @Req() request: AccountRequest) {
    const accountId = this.accountId(request, tenantId);
    return this.communications.deleteMessage(tenantId, messageId, { side: 'client', accountId });
  }
}
