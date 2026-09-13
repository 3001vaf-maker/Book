import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunicationService } from '../communication/communication.service';
import { NotificationService } from '../notification/notification.service';
import { BookingAccountGuard } from './booking-account.guard';
import { BookingRequiredConsentGuard } from './booking-required-consent.guard';
import { OnlineBookingService } from './online-booking.service';

type OwnerRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };
type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class OnlineBookingController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly notifications: NotificationService,
    private readonly communications: CommunicationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Put('owner/publication')
  publish(@Req() request: OwnerRequest, @Body() body: { data?: unknown }) {
    return this.booking.publish(request.auth!.tenantId, body?.data || {});
  }

  @UseGuards(JwtAuthGuard)
  @Get('owner/accounts')
  ownerAccounts(@Req() request: OwnerRequest) {
    return this.booking.ownerAccounts(request.auth!.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('owner/accounts/sync')
  syncOwnerAccounts(@Req() request: OwnerRequest, @Body() body: { accounts?: unknown }) {
    return this.booking.syncOwnerAccounts(request.auth!.tenantId, body?.accounts || []);
  }

  @UseGuards(JwtAuthGuard)
  @Get('owner/requests')
  pendingRequests(@Req() request: OwnerRequest) {
    return this.booking.pendingRequests(request.auth!.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('owner/requests/:requestId/imported')
  markImported(@Req() request: OwnerRequest, @Param('requestId') requestId: string, @Body() body: { recordId?: string }) {
    return this.booking.markImported(request.auth!.tenantId, requestId, body?.recordId || '');
  }

  @UseGuards(JwtAuthGuard)
  @Put('owner/requests/:requestId/snapshot')
  syncRequestSnapshot(@Req() request: OwnerRequest, @Param('requestId') requestId: string, @Body() body: { snapshot?: unknown }) {
    return this.booking.syncRequestSnapshot(request.auth!.tenantId, requestId, body?.snapshot || {});
  }

  @UseGuards(JwtAuthGuard)
  @Post('owner/requests/:requestId/rejected')
  markRejected(@Req() request: OwnerRequest, @Param('requestId') requestId: string) {
    return this.booking.markRejected(request.auth!.tenantId, requestId);
  }

  @Get(':tenantId/context')
  context(@Param('tenantId') tenantId: string, @Query('workplace') workplace = '') {
    return this.booking.getContext(tenantId, workplace);
  }

  @Post(':tenantId/account/prepare')
  prepareAccount(@Param('tenantId') tenantId: string, @Body() body: { email?: string }) {
    return this.booking.prepareAccount(tenantId, body?.email || '');
  }

  @Post(':tenantId/account/register')
  registerAccount(@Param('tenantId') tenantId: string, @Body() body: Record<string, any>) {
    return this.booking.registerAccount(tenantId, body || {});
  }

  @Post(':tenantId/account/login')
  loginAccount(@Param('tenantId') tenantId: string, @Body() body: { email?: string; password?: string }) {
    return this.booking.loginAccount(tenantId, body?.email || '', body?.password || '');
  }

  @UseGuards(BookingAccountGuard)
  @Get(':tenantId/account/me')
  account(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.booking.getAccount(tenantId, request.bookingAccountAuth!.accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Put(':tenantId/account/me')
  updateAccount(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: Record<string, any>) {
    return this.booking.updateAccount(tenantId, request.bookingAccountAuth!.accountId, body || {});
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/telegram-entry')
  bindTelegramEntry(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: { token?: unknown }) {
    return this.communications.bindTelegramEntry(tenantId, request.bookingAccountAuth!.accountId, body?.token);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Get(':tenantId/account/requests')
  myRequests(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.booking.getMyRequests(tenantId, request.bookingAccountAuth!.accountId);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Get(':tenantId/account/notifications')
  notificationsFeed(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.notifications.listForAccount(tenantId, request.bookingAccountAuth!.accountId);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Post(':tenantId/account/notifications/:notificationId/read')
  markNotificationRead(
    @Param('tenantId') tenantId: string,
    @Param('notificationId') notificationId: string,
    @Req() request: AccountRequest,
  ) {
    return this.notifications.markReadForAccount(tenantId, request.bookingAccountAuth!.accountId, notificationId);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Post(':tenantId/requests')
  async createRequest(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: Record<string, any>) {
    const accountId = request.bookingAccountAuth!.accountId;
    const created = await this.booking.createRequest(tenantId, accountId, body || {});
    await this.notifications.createForAccount(tenantId, accountId, {
      type: 'booking.created',
      title: 'Запись создана',
      body: 'Новая запись добавлена в ваш клиентский аккаунт.',
      entityType: 'booking-request',
      entityId: String((created as any)?.id || ''),
    });
    return created;
  }
}
