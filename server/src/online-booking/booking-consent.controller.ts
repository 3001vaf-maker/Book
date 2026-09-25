import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CommunicationService } from '../communication/communication.service';
import { ConsentPolicyService } from '../tenant-document-archive/consent-policy.service';
import { PrismaService } from '../prisma.service';
import { AccountGuard } from './account.guard';

type AccountRequest = Request & { accountAuth?: { accountId: string; tenantId: string } };

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
    const auth = request.accountAuth!;
    const account = await this.prisma.account.findUnique({
      where: { id: auth.accountId },
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

  @UseGuards(AccountGuard)
  @Get(':tenantId/account/consent-state')
  async state(@Req() request: AccountRequest) {
    const auth = request.accountAuth!;
    return consentState;
  }

  @UseGuards(AccountGuard)
  @Post(':tenantId/account/consents')
  async accept(@Req() request: AccountRequest, @Body() body: { consents?: unknown }) {
    const auth = request.accountAuth!;
    await this.consentPolicy.acceptAccountConsents(auth.tenantId, auth.accountId, body?.consents || [], 'online-booking-account');
    const consentState = await this.consentPolicy.accountConsentState(auth.tenantId, auth.accountId);
    if (consentState?.pdnActive) {
      await this.prisma.accountTenantLink.upsert({
        where: { accountId_tenantId: { accountId: auth.accountId, tenantId: auth.tenantId } },
        create: { accountId: auth.accountId, tenantId: auth.tenantId },
        update: { updatedAt: new Date() },
      });
    }
    if (acceptedMessages(body?.consents)) {
      const contacts = await this.currentContactPoints(request);
      for (const contact of contacts) {
        await this.consentPolicy.acceptContactPointConsent(auth.tenantId, contact.type, contact.value, 'messages-consent', 'online-booking-account');
      }
    }
    return this.consentPolicy.accountConsentState(auth.tenantId, auth.accountId);
  }

  @UseGuards(AccountGuard)
  @Post(':tenantId/account/consents/:documentId/revoke')
  async revoke(
    @Req() request: AccountRequest,
    @Param('documentId') documentId: string,
  ) {
    const auth = request.accountAuth!;
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
