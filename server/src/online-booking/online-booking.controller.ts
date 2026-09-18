import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClientContactRouteService } from '../communication/client-contact-route.service';
import { CommunicationService } from '../communication/communication.service';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { NotificationService } from '../notification/notification.service';
import { bookingTemplateValues, NotificationTemplateService } from '../notification/notification-template.service';
import { WebPushService } from '../notification/web-push.service';
import { BookingAccountGuard } from './booking-account.guard';
import { BookingPublicationGuard } from './booking-publication.guard';
import { BookingRequiredConsentGuard } from './booking-required-consent.guard';
import { ClientCardLinkService } from './client-card-link.service';
import { OnlineBookingService } from './online-booking.service';

type OwnerRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };
type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class OnlineBookingController {
  constructor(
    private readonly booking: OnlineBookingService,
    private readonly notifications: NotificationService,
    private readonly templates: NotificationTemplateService,
    private readonly communications: CommunicationService,
    private readonly contactRoutes: ClientContactRouteService,
    private readonly consents: ConsentPolicyService,
    private readonly webPush: WebPushService,
    private readonly clientCards: ClientCardLinkService,
    private readonly legal: LegalRuntimeService,
  ) {}

  private async accountTelegramSettings(tenantId: string, accountId: string) {
    const account = await this.booking.getAccount(tenantId, accountId);
    const identity = await this.communications.telegramIdentity(tenantId, { phone: account.phone, uei: account.uei });
    if (!identity) return { telegram: { linked: false, enabled: false, username: '' } };
    const consent = await this.consents.contactPointConsentState(
      tenantId,
      'TELEGRAM',
      identity.externalUserId,
      'messages-consent',
    );
    return {
      telegram: {
        linked: true,
        enabled: Boolean(consent.allowed),
        username: identity.display || '',
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('owner/publication')
  async publish(@Req() request: OwnerRequest, @Body() body: { data?: unknown }) {
    await this.legal.assertCanPublishBooking(request.auth!.tenantId, request.auth!.userId);
    const result = await this.booking.publish(request.auth!.tenantId, body?.data || {});
    await this.legal.audit(request.auth!.tenantId, request.auth!.userId, 'BOOKING_PUBLICATION_UPDATED', 'PUBLIC_BOOKING', 'SUCCESS');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('owner/accounts')
  ownerAccounts(@Req() request: OwnerRequest) {
    return this.booking.ownerAccounts(request.auth!.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('owner/accounts/sync')
  async syncOwnerAccounts(@Req() request: OwnerRequest, @Body() body: { accounts?: unknown }) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.booking.syncOwnerAccounts(request.auth!.tenantId, body?.accounts || []);
  }

  @UseGuards(JwtAuthGuard)
  @Post('owner/reconcile-legacy-client-cards')
  async reconcileLegacyClientCards(@Req() request: OwnerRequest) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.clientCards.reconcileLegacyAccountDuplicates(request.auth!.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('owner/requests')
  pendingRequests(@Req() request: OwnerRequest) {
    return this.booking.pendingRequests(request.auth!.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('owner/requests/:requestId/imported')
  async markImported(@Req() request: OwnerRequest, @Param('requestId') requestId: string, @Body() body: { recordId?: string }) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.booking.markImported(request.auth!.tenantId, requestId, body?.recordId || '');
  }

  @UseGuards(JwtAuthGuard)
  @Put('owner/requests/:requestId/snapshot')
  async syncRequestSnapshot(@Req() request: OwnerRequest, @Param('requestId') requestId: string, @Body() body: { snapshot?: unknown }) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.booking.syncRequestSnapshot(request.auth!.tenantId, requestId, body?.snapshot || {});
  }

  @UseGuards(JwtAuthGuard)
  @Post('owner/requests/:requestId/rejected')
  async markRejected(@Req() request: OwnerRequest, @Param('requestId') requestId: string) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.booking.markRejected(request.auth!.tenantId, requestId);
  }

  @UseGuards(BookingPublicationGuard)
  @Get(':tenantId/context')
  context(@Param('tenantId') tenantId: string, @Query('workplace') workplace = '') {
    return this.booking.getContext(tenantId, workplace);
  }

  @UseGuards(BookingPublicationGuard)
  @Post(':tenantId/account/prepare')
  prepareAccount(@Param('tenantId') tenantId: string, @Body() body: { email?: string }) {
    return this.booking.prepareAccount(tenantId, body?.email || '');
  }

  @UseGuards(BookingPublicationGuard)
  @Post(':tenantId/account/register')
  async registerAccount(@Param('tenantId') tenantId: string, @Body() body: Record<string, any>) {
    await this.clientCards.validateNewAccountContacts(tenantId, body || {});
    return this.booking.registerAccount(tenantId, body || {});
  }

  @UseGuards(BookingPublicationGuard)
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
  async updateAccount(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: Record<string, any>) {
    await this.legal.assertPublicBooking(tenantId);
    const accountId = request.bookingAccountAuth!.accountId;
    await this.clientCards.validateAccountContactUpdate(tenantId, accountId, body || {});
    return this.booking.updateAccount(tenantId, accountId, body || {});
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/telegram-entry')
  async bindTelegramEntry(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: { token?: unknown }) {
    await this.legal.assertPublicBooking(tenantId);
    const accountId = request.bookingAccountAuth!.accountId;
    const result = await this.communications.bindTelegramEntry(tenantId, accountId, body?.token);
    const accountConsent = await this.consents.accountConsentProjection(tenantId, accountId);
    const messagesAccepted = accountConsent.some((item) => item.documentId === 'messages-consent' && item.accepted);
    if (messagesAccepted) {
      const account = await this.booking.getAccount(tenantId, accountId);
      const identity = await this.communications.telegramIdentity(tenantId, { phone: account.phone, uei: account.uei });
      if (identity?.externalUserId) {
        await this.consents.acceptContactPointConsent(
          tenantId,
          'TELEGRAM',
          identity.externalUserId,
          'messages-consent',
          'telegram-contact-link',
        );
      }
    }
    return result;
  }

  @UseGuards(BookingAccountGuard)
  @Get(':tenantId/account/chat/settings')
  async chatSettings(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    await this.legal.assertPublicBooking(tenantId);
    return this.accountTelegramSettings(tenantId, request.bookingAccountAuth!.accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Put(':tenantId/account/chat/telegram-consent')
  async updateTelegramConsent(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { enabled?: unknown },
  ) {
    await this.legal.assertPublicBooking(tenantId);
    const accountId = request.bookingAccountAuth!.accountId;
    const account = await this.booking.getAccount(tenantId, accountId);
    const identity = await this.communications.telegramIdentity(tenantId, { phone: account.phone, uei: account.uei });
    if (!identity) throw new BadRequestException('Telegram не привязан');
    if (body?.enabled === true) {
      await this.consents.acceptContactPointConsent(
        tenantId,
        'TELEGRAM',
        identity.externalUserId,
        'messages-consent',
        'client-chat-settings',
      );
    } else {
      await this.consents.revokeContactPointConsent(
        tenantId,
        'TELEGRAM',
        identity.externalUserId,
        'messages-consent',
        'client-chat-settings',
      );
    }
    return this.accountTelegramSettings(tenantId, accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Get(':tenantId/account/push/config')
  async pushConfiguration(@Param('tenantId') tenantId: string) {
    await this.legal.assertPublicBooking(tenantId);
    return this.webPush.configuration();
  }

  @UseGuards(BookingAccountGuard)
  @Put(':tenantId/account/push/subscription')
  async savePushSubscription(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { subscription?: unknown },
  ) {
    await this.legal.assertPublicBooking(tenantId);
    const userAgent = Array.isArray(request.headers['user-agent'])
      ? request.headers['user-agent'][0] || ''
      : request.headers['user-agent'] || '';
    return this.webPush.saveSubscription(
      tenantId,
      request.bookingAccountAuth!.accountId,
      body?.subscription,
      userAgent,
    );
  }

  @UseGuards(BookingAccountGuard)
  @Delete(':tenantId/account/push/subscription')
  async deletePushSubscription(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { endpoint?: unknown },
  ) {
    await this.legal.assertPublicBooking(tenantId);
    return this.webPush.deleteSubscription(tenantId, request.bookingAccountAuth!.accountId, body?.endpoint);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Get(':tenantId/account/requests')
  async myRequests(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    await this.legal.assertPublicBooking(tenantId);
    return this.booking.getMyRequests(tenantId, request.bookingAccountAuth!.accountId);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Get(':tenantId/account/notifications')
  async notificationsFeed(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    await this.legal.assertPublicBooking(tenantId);
    return this.notifications.listForAccount(tenantId, request.bookingAccountAuth!.accountId);
  }

  @UseGuards(BookingAccountGuard, BookingRequiredConsentGuard)
  @Post(':tenantId/account/notifications/:notificationId/read')
  async markNotificationRead(
    @Param('tenantId') tenantId: string,
    @Param('notificationId') notificationId: string,
    @Req() request: AccountRequest,
  ) {
    await this.legal.assertPublicBooking(tenantId);
    return this.notifications.markReadForAccount(tenantId, request.bookingAccountAuth!.accountId, notificationId);
  }

  @UseGuards(BookingAccountGuard)
  @Get(':tenantId/account/chat')
  async accountChat(@Param('tenantId') tenantId: string, @Req() request: AccountRequest) {
    await this.legal.assertPublicBooking(tenantId);
    const accountId = request.bookingAccountAuth!.accountId;
    const profiles = await this.contactRoutes.accessibleProfilesForAccount(tenantId, accountId);
    const threads = await Promise.all(profiles.map((profile) => this.communications.listThread(tenantId, { profileKey: profile.profileKey }, 500)));
    const merged = threads.flat().filter((message) => String(message.channel || '').toUpperCase() !== 'OWNER_IN_APP').sort((left, right) => {
      const byTime = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      return byTime || String(left.id).localeCompare(String(right.id));
    });
    return merged.slice(Math.max(0, merged.length - 500));
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/chat/messages')
  async sendAccountChatMessage(
    @Param('tenantId') tenantId: string,
    @Req() request: AccountRequest,
    @Body() body: { body?: unknown; attachments?: unknown },
  ) {
    await this.legal.assertPublicBooking(tenantId);
    const message = String(body?.body ?? '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!message && !attachments.length) throw new BadRequestException('Пустое сообщение');
    const account = await this.booking.getAccount(tenantId, request.bookingAccountAuth!.accountId);
    return this.communications.recordMessage(tenantId, {
      phone: account.phone,
      uei: account.uei,
      direction: 'inbound',
      kind: attachments.length ? 'media' : 'message',
      channel: 'IN_APP',
      body: message,
      attachments,
      status: 'delivered',
    });
  }

  @UseGuards(BookingPublicationGuard, BookingAccountGuard, BookingRequiredConsentGuard)
  @Post(':tenantId/requests')
  async createRequest(@Param('tenantId') tenantId: string, @Req() request: AccountRequest, @Body() body: Record<string, any>) {
    const accountId = request.bookingAccountAuth!.accountId;
    const created = await this.booking.createRequest(tenantId, accountId, body || {});
    const createdValue = created as any;
    const procedureNames = Array.isArray(createdValue?.procedures)
      ? createdValue.procedures.map((item: any) => String(item?.name || '').trim()).filter(Boolean)
      : [];
    const account = await this.booking.getAccount(tenantId, accountId);
    const values = bookingTemplateValues({
      client: [account.name, account.surname].filter(Boolean).join(' ').trim() || account.phone,
      date: createdValue?.date,
      from: createdValue?.from,
      to: createdValue?.to,
      services: procedureNames.join(', '),
    });
    const [ownerTemplate, clientTemplate] = await Promise.all([
      this.templates.render(tenantId, 'owner.booking.created', values),
      this.templates.render(tenantId, 'booking.created', values),
    ]);
    if (ownerTemplate.enabled) {
      await this.communications.recordMessage(tenantId, {
        bookingAccountId: accountId,
        direction: 'system',
        kind: 'system',
        channel: 'OWNER_IN_APP',
        body: [ownerTemplate.title, ownerTemplate.body].filter(Boolean).join('\n'),
        externalMessageId: `booking-request:${String(createdValue?.id || '')}`,
        externalThreadId: 'booking',
        status: 'delivered',
      }).catch(() => null);
    }
    if (clientTemplate.enabled) {
      await this.notifications.createForAccount(tenantId, accountId, {
        type: 'booking.created',
        title: clientTemplate.title,
        body: clientTemplate.body,
        entityType: 'booking-request',
        entityId: String(createdValue?.id || ''),
      }).catch(() => null);
    }
    return created;
  }
}
