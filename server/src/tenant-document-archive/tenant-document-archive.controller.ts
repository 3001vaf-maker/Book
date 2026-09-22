import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsentPolicyService } from './consent-policy.service';
import { TenantDocumentArchiveService } from './tenant-document-archive.service';
import { RknGuideService } from './rkn-guide.service';

type AuthenticatedRequest = Request & { auth?: { platformAccountId: string; tenantId: string; role: string } };

@Controller('tenant-document-archive')
@UseGuards(JwtAuthGuard)
export class TenantDocumentArchiveController {
  constructor(
    private readonly documents: TenantDocumentArchiveService,
    private readonly consentPolicy: ConsentPolicyService,
    private readonly rknGuide: RknGuideService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.documents.get(request.auth!.tenantId);
  }

  @Post('rkn-guide/ensure')
  ensureRknGuide(@Req() request: AuthenticatedRequest) {
    return this.rknGuide.ensure(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Get('rkn-guide.pdf')
  async downloadRknGuide(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Query('documentId') documentId = '',
  ) {
    const result = await this.rknGuide.download(
      request.auth!.tenantId,
      request.auth!.platformAccountId,
      String(documentId || ''),
    );
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Book-Document-Id': result.documentId,
    });
    return new StreamableFile(result.pdf);
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
