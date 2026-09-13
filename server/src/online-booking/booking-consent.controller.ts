import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessStateService } from '../business-state/business-state.service';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { BookingAccountGuard } from './booking-account.guard';

type AccountRequest = Request & { bookingAccountAuth?: { accountId: string; tenantId: string } };

@Controller('online-booking')
export class BookingConsentController {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly consentPolicy: ConsentPolicyService,
  ) {}

  private async clientId(request: AccountRequest) {
    const auth = request.bookingAccountAuth!;
    const identity = await this.businessState.bookingIdentityForAccount(auth.tenantId, auth.accountId);
    return String(identity?.person?.key || '').trim();
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
    return this.consentPolicy.requiredConsentState(auth.tenantId, clientId);
  }
}
