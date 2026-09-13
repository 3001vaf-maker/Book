import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessStateService } from '../business-state/business-state.service';
import { CommunicationService } from '../communication/communication.service';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { PrismaService } from '../prisma.service';
import { BookingAccountGuard } from './booking-account.guard';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

function acceptedMessages(value: unknown) {
  return (Array.isArray(value) ? value : []).some((item: any) => String(item?.documentId || '').trim() === 'messages-consent' && Boolean(item?.accepted));
}

@Controller('online-booking')
export class BookingConsentController {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly consentPolicy: ConsentPolicyService,
    private readonly communications: CommunicationService,
    private readonly prisma: PrismaService,
  ) {}

  private async clientId(request: AccountRequest) {
    const auth = request.bookingAccountAuth!;
    const identity = await this.businessState.bookingIdentityForAccount(auth.tenantId, auth.accountId);
    return String(identity?.person?.key || '').trim();
  }

  private async currentContactPoints(request: AccountRequest) {
    const auth = request.bookingAccountAuth!;
    const account = await this.prisma.bookingAccount.findFirst({
      where: { id: auth.accountId, tenantId: auth.tenantId },
      select: { phone: true, email: true, uei: true },
    });
    if (!account) return [];
    const telegram = await this.communications.telegramIdentity(auth.tenantId, { phone: account.phone, uei: account.uei });
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
    const clientId = await this.clientId(request);
    if (!clientId) return { allowed: false, required: [], missing: [], consents: [] };
    return this.consentPolicy.requiredConsentState(auth.tenantId, clientId);
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/consents')
  async accept(@Req() request: AccountRequest, @Body() body: { consents?: unknown }) {
    const auth = request.bookingAccountAuth!;
    const clientId = await this.clientId(request);
    if (!clientId) return { allowed: false, required: [], missing: [], consents: [] };
    await this.consentPolicy.acceptConsents(auth.tenantId, clientId, body?.consents || []);
    if (acceptedMessages(body?.consents)) {
      const contacts = await this.currentContactPoints(request);
      for (const contact of contacts) {
        await this.consentPolicy.acceptContactPointConsent(auth.tenantId, clientId, contact.type, contact.value, 'messages-consent', 'online-booking-account');
      }
    }
    return this.consentPolicy.requiredConsentState(auth.tenantId, clientId);
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/consents/:documentId/revoke')
  async revoke(
    @Req() request: AccountRequest,
    @Param('documentId') documentId: string,
  ) {
    const auth = request.bookingAccountAuth!;
    const clientId = await this.clientId(request);
    if (!clientId) return { allowed: false, required: [], missing: [], consents: [] };
    await this.consentPolicy.revokeConsent(auth.tenantId, clientId, documentId, 'online-booking');
    if (documentId === 'messages-consent') {
      const contacts = await this.currentContactPoints(request);
      for (const contact of contacts) {
        await this.consentPolicy.revokeContactPointConsent(auth.tenantId, clientId, contact.type, contact.value, documentId, 'online-booking');
      }
    }
    return this.consentPolicy.requiredConsentState(auth.tenantId, clientId);
  }
}
