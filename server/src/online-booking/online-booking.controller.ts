import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunicationService } from '../communication/communication.service';
import { AccountDocumentService } from '../document-registry/account-document.service';
import { NotificationService } from '../notification/notification.service';
import { WebPushService } from '../notification/web-push.service';
import { AccountGuard } from './account.guard';
import { BookingPdnConsentGuard } from './booking-pdn-consent.guard';
import { PersonIdentityService } from './person-identity.service';
import { OnlineBookingService } from './online-booking.service';

type OwnerRequest = Request & { auth?: { platformAccountId: string; tenantId: string; role: string } };
type AccountRequest = Request & { accountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class OnlineBookingController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly accountDocuments: AccountDocumentService,
    private readonly notifications: NotificationService,
    private readonly communications: CommunicationService,
    private readonly webPush: WebPushService,
    private readonly personIdentity: PersonIdentityService,
  ) {}

  private async accountTelegramSettings(tenantId: string, accountId: string) {
    const account = await this.booking.getAccount(tenantId, accountId);
    const identity = await this.communications.telegramIdentity(tenantId, { phone: account.phone, uei: account.uei });
    if (!identity) return { telegram: { linked: false, enabled: false, username: '' } };
    return {
      telegram: {
        linked: true,
        enabled: true,
        username: identity.display || '',
      },
    };
  }

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
  @Post('owner/reconcile-legacy-people')
  reconcileLegacyPeople(@Req() request: OwnerRequest) {
    return this.personIdentity.reconcileLegacyAccountDuplicates(request.auth!.tenantId);
  }

  @Get('account-terms')
  accountTerms() {
    return this.accountDocuments.publicTerms();
  }

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/platform-state')
  accountPlatformState(@Req() request: AccountRequest) {
    return this.accountDocuments.state(request.accountAuth!.accountId);
  }

  @UseGuards(AccountGuard)
  @Post(':tenantId/account/platform-terms')
  acceptAccountTerms(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { accountTerms?: unknown },
  ) {
    return this.accountDocuments.accept(
      request.accountAuth!.accountId,
      body?.accountTerms,
      'online-booking-account',
      { tenantContext: tenantId },
    );
  }

  @Get(':tenantId/context')
  context(@Param('tenantId') tenantId: string, @Query('workplace') workplace = '') {
    return this.booking.getContext(tenantId, workplace);
  }

  @Post(':tenantId/account/prepare')
  prepareAccount(
    @Param('tenantId') tenantId: string,
    @Body() body: { identifier?: unknown; email?: unknown; phone?: unknown },
  ) {
    return this.booking.prepareAccount(tenantId, body || {});
  }

  @Post(':tenantId/account/register')
  registerAccount(@Param('tenantId') tenantId: string, @Body() body: Record<string, any>) {
    return this.booking.registerAccount(tenantId, body || {});
  }

  @Post(':tenantId/account/login')
  loginAccount(@Param('tenantId') tenantId: string, @Body() body: { identifier?: unknown; email?: unknown; password?: unknown }) {
    return this.booking.loginAccount(tenantId, body?.identifier ?? body?.email ?? '', body?.password ?? '');
  }

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/me')
  account(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.booking.getAccount(tenantId, request.accountAuth!.accountId);
  }

  @UseGuards(AccountGuard)
  @Put(':tenantId/account/me')
  updateAccount(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: Record<string, any>) {
    return this.booking.updateAccount(tenantId, request.accountAuth!.accountId, body || {});
  }

  @Post(':tenantId/account/telegram-entry/resolve')
  async resolveTelegramEntry(
    @Param('tenantId') tenantId: string,
    @Body() body: { token?: unknown },
  ) {
    const resolved = await this.communications.resolveTelegramEntryAccount(tenantId, body?.token);
    if (!resolved.exists || !resolved.accountId) return { exists: false };
    const payload = await this.booking.resumeAccount(tenantId, resolved.accountId);
    await this.communications.bindTelegramEntry(tenantId, resolved.accountId, body?.token);
    await this.booking.syncAccountPersonContacts(resolved.accountId);
    return { ...payload, exists: true };
  }

  @UseGuards(AccountGuard)
  @Post(':tenantId/account/telegram-entry')
  async bindTelegramEntry(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: { token?: unknown }) {
    const result = await this.communications.bindTelegramEntry(tenantId, request.accountAuth!.accountId, body?.token);
    await this.booking.syncAccountPersonContacts(request.accountAuth!.accountId);
    return result;
  }

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/chat/settings')
  chatSettings(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.accountTelegramSettings(tenantId, request.accountAuth!.accountId);
  }

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/push/config')
  pushConfiguration() {
    return this.webPush.configuration();
  }

  @UseGuards(AccountGuard)
  @Put(':tenantId/account/push/subscription')
  savePushSubscription(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { subscription?: unknown },
  ) {
    const userAgent = Array.isArray(request.headers['user-agent'])
      ? request.headers['user-agent'][0] || ''
      : request.headers['user-agent'] || '';
    return this.webPush.saveSubscription(
      tenantId,
      request.accountAuth!.accountId,
      body?.subscription,
      userAgent,
    );
  }

  @UseGuards(AccountGuard)
  @Delete(':tenantId/account/push/subscription')
  deletePushSubscription(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { endpoint?: unknown },
  ) {
    return this.webPush.deleteSubscription(tenantId, request.accountAuth!.accountId, body?.endpoint);
  }

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/records')
  myRecords(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.booking.getMyRecords(tenantId, request.accountAuth!.accountId);
  }

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/notifications')
  notificationsFeed(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    return this.notifications.listForAccount(tenantId, request.accountAuth!.accountId);
  }

  @UseGuards(AccountGuard)
  @Post(':tenantId/account/notifications/:notificationId/read')
  markNotificationRead(
    @Param('tenantId') tenantId: string,
    @Param('notificationId') notificationId: string,
    @Req() request: AccountRequest,
  ) {
    return this.notifications.markReadForAccount(tenantId, request.accountAuth!.accountId, notificationId);
  }

  @UseGuards(AccountGuard, BookingPdnConsentGuard)
  @Get(':tenantId/account/chat')
  async accountChat(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    const account = await this.booking.getAccount(tenantId, request.accountAuth!.accountId);
    return this.communications.listThread(tenantId, { phone: account.phone, uei: account.uei }, 500);
  }

  @UseGuards(AccountGuard, BookingPdnConsentGuard)
  @Post(':tenantId/account/chat/messages')
  async sendAccountChatMessage(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { body?: unknown; attachments?: unknown },
  ) {
    const message = String(body?.body ?? '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!message && !attachments.length) throw new BadRequestException('Пустое сообщение');
    const account = await this.booking.getAccount(tenantId, request.accountAuth!.accountId);
    return this.communications.recordMessage(tenantId, {
      phone: account.phone,
      uei: account.uei,
      direction: 'inbound',
      kind: attachments.length ? 'media' : 'message',
      purpose: 'DIRECT',
      channel: 'IN_APP',
      body: message,
      attachments,
      status: 'delivered',
    });
  }

  @UseGuards(AccountGuard, BookingPdnConsentGuard)
  @Post(':tenantId/requests')
  async createRequest(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: Record<string, any>) {
    const accountId = request.accountAuth!.accountId;
    const created = await this.booking.createRequest(tenantId, accountId, body || {});
    await this.notifications.createForAccount(tenantId, accountId, {
      purpose: 'SERVICE',
      type: 'booking.created',
      title: 'Запись создана',
      body: 'Новая запись добавлена в ваш аккаунт.',
      entityType: 'record',
      entityId: String((created as any)?.recordId || ''),
    });
    return created;
  }
}
