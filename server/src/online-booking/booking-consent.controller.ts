import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { BookingAccountGuard } from './booking-account.guard';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class BookingConsentController {
  constructor(private readonly consentPolicy: ConsentPolicyService) {}

  @UseGuards(BookingAccountGuard)
  @Get(':tenantId/account/consent-state')
  async state(@Req() request: AccountRequest) {
    const auth = request.bookingAccountAuth!;
    return this.consentPolicy.requiredConsentState(auth.tenantId, auth.accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/consents')
  async accept(@Req() request: AccountRequest, @Body() body: { consents?: unknown }) {
    const auth = request.bookingAccountAuth!;
    await this.consentPolicy.acceptAccountConsents(
      auth.tenantId,
      auth.accountId,
      body?.consents || [],
      'online-booking-account',
    );
    return this.consentPolicy.requiredConsentState(auth.tenantId, auth.accountId);
  }

  @UseGuards(BookingAccountGuard)
  @Post(':tenantId/account/consents/:documentId/revoke')
  async revoke(
    @Req() request: AccountRequest,
    @Param('documentId') documentId: string,
  ) {
    const auth = request.bookingAccountAuth!;
    await this.consentPolicy.revokeAccountConsent(auth.tenantId, auth.accountId, documentId, 'online-booking');
    return this.consentPolicy.requiredConsentState(auth.tenantId, auth.accountId);
  }
}
