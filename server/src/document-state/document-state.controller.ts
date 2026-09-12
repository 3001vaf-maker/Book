import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentStateService } from './document-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('document-state')
@UseGuards(JwtAuthGuard)
export class DocumentStateController {
  constructor(private readonly documents: DocumentStateService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.documents.get(request.auth!.tenantId);
  }

  @Get('consents/report')
  consentReport(@Req() request: AuthenticatedRequest) {
    return this.documents.consentReport(request.auth!.tenantId);
  }

  @Get('consents/client/:clientId')
  clientConsents(@Req() request: AuthenticatedRequest, @Param('clientId') clientId: string) {
    return this.documents.clientConsentProjection(request.auth!.tenantId, clientId);
  }

  @Post('consents/client/:clientId/:documentId/revoke')
  revokeConsent(
    @Req() request: AuthenticatedRequest,
    @Param('clientId') clientId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.revokeConsent(request.auth!.tenantId, clientId, documentId, 'owner');
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
