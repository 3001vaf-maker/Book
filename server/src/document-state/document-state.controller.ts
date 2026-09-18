import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsentPolicyService } from './consent-policy.service';
import { DocumentStateService } from './document-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('document-state')
@UseGuards(JwtAuthGuard)
export class DocumentStateController {
  constructor(
    private readonly documents: DocumentStateService,
    private readonly consentPolicy: ConsentPolicyService,
  ) {}

  @Get()
  async get(@Req() request: AuthenticatedRequest) {
    await this.consentPolicy.ensureCanonicalConsentEvents(request.auth!.tenantId);
    return this.documents.get(request.auth!.tenantId);
  }

  @Get('bases')
  bases() {
    return this.documents.userDocumentBases();
  }

  @Get('consents/report')
  consentReport(@Req() request: AuthenticatedRequest) {
    return this.consentPolicy.consentReport(request.auth!.tenantId);
  }

  @Get('consents/account/:accountId')
  accountConsents(@Req() request: AuthenticatedRequest, @Param('accountId') accountId: string) {
    return this.consentPolicy.accountConsentProjection(request.auth!.tenantId, accountId);
  }

  @Post('consents/account/:accountId/:documentId/revoke')
  revokeAccountConsent(
    @Req() request: AuthenticatedRequest,
    @Param('accountId') accountId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.consentPolicy.revokeAccountConsent(request.auth!.tenantId, accountId, documentId, 'owner');
  }

  @Post('migrate')
  migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.documents.migrate(request.auth!.tenantId, body);
  }

  @Post('migrate/verify')
  verify(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.documents.verifyMigration(request.auth!.tenantId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.documents.bootstrap(request.auth!.tenantId, body);
  }

  @Put(':dataset')
  updateDataset(@Req() request: AuthenticatedRequest, @Param('dataset') dataset: string, @Body() body: unknown) {
    return this.documents.updateDataset(request.auth!.tenantId, dataset, body);
  }
}
