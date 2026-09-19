import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CommunicationService } from '../communication/communication.service';
import { ConsentPolicyService } from '../tenant-document-archive/consent-policy.service';
import { PrismaService } from '../prisma.service';
import { BookingAccountGuard } from './booking-account.guard';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

function acceptedMessages(value: unknown) {
  return (Array.isArray(value) ? value : []).some((item: any) => String(item?.documentId || '').trim() === 'messages-consent' && Boolean(item?.accepted));
}

@Controller('online-booking')
export class BookingConsentController {
  constructor(
    private readonly consentPolicy: ConsentPolicyService,
    private readonly communications: CommunicationService,
    private readonly prisma: PrismaService,
  ) {}

  private async currentContactPoints(request: AccountRequest) {
    const auth = request.bookingAccountAuth!;
    const account = await this.prisma.bookingAccount.findFirst({
      where: { id: auth.accountId, tenantId: auth.tenantId },
      select: { phone: true, email: true },
    });
    if (!account) return [];
    const telegram = await this.communications.telegramIdentity(auth.tenantId, { phone: account.phone });
    return [
      { type: 'PHONE', value: account.phone },
      { type: 'EMAIL', value: account.email },
      ...(telegram?.externalUserId ? [{ type: 'TELEGRAM', value: telegram.externalUserId }] : []),
    ].filter((item) => String(item.value || '').trim());
  }

  @UseGuards(BookingAccountGuard)
  @Get(':tenantId/account/consent-state')
  async state(@Req() request: AccountRequest) {
    const auth = request.bookingAccountAuth!;
    return this.consentPolicy.accountConsentState(auth.tenantId, auth.accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/consents')
  async accept(@Req() request: AccountRequest, @Body() body: { consents?: unknown }) {
    const auth = request.bookingAccountAuth!;
    await this.consentPolicy.acceptAccountConsents(auth.tenantId, auth.accountId, body?.consents || [], 'online-booking-account');
    if (acceptedMessages(body?.consents)) {
      const contacts = await this.currentContactPoints(request);
      for (const contact of contacts) {
        await this.consentPolicy.acceptContactPointConsent(auth.tenantId, contact.type, contact.value, 'messages-consent', 'online-booking-account');
      }
    }
    return this.consentPolicy.accountConsentState(auth.tenantId, auth.accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/consents/:documentId/revoke')
  async revoke(
    @Req() request: AccountRequest,
    @Param('documentId') documentId: string,
  ) {
    const auth = request.bookingAccountAuth!;
    await this.consentPolicy.revokeAccountConsent(auth.tenantId, auth.accountId, documentId, 'online-booking');
    if (documentId === 'messages-consent') {
      const contacts = await this.currentContactPoints(request);
      for (const contact of contacts) {
        await this.consentPolicy.revokeContactPointConsent(auth.tenantId, contact.type, contact.value, documentId, 'online-booking');
      }
    }
    return this.consentPolicy.accountConsentState(auth.tenantId, auth.accountId);
  }
}
