import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsentPolicyService } from './consent-policy.service';
import { DocumentArchiveService } from './document-archive.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('document-archive')
@UseGuards(JwtAuthGuard)
export class DocumentArchiveController {
  constructor(
    private readonly documents: DocumentArchiveService,
    private readonly consentPolicy: ConsentPolicyService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.documents.get(request.auth!.tenantId);
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
