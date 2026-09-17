import { Body, ConflictException, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { LegalRuntimeService } from './legal-runtime.service';

type AuthRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('platform/legal')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformLegalController {
  constructor(private readonly legal: LegalRuntimeService) {}

  @Get('readiness')
  readiness() {
    return this.legal.platformReadiness();
  }

  @Put('checklist')
  checklist(@Req() request: AuthRequest, @Body() body: { checklist?: unknown }) {
    return this.legal.updatePlatformChecklist(request.auth!.userId, body?.checklist || {});
  }

  @Post('filing/prepared')
  prepared(@Req() request: AuthRequest) {
    return this.legal.markPlatformPrepared(request.auth!.userId);
  }

  @Post('filing/submitted')
  submitted(@Req() request: AuthRequest, @Body() body: { submissionReference?: unknown; evidenceMetadata?: unknown }) {
    return this.legal.confirmPlatformSubmitted(request.auth!.userId, body || {});
  }

  @Post('legal-ready')
  legalReady(@Req() request: AuthRequest) {
    return this.legal.markPlatformLegalReady(request.auth!.userId);
  }

  @Post('pre-launch')
  preLaunch(@Req() request: AuthRequest, @Body() body: { reason?: unknown }) {
    return this.legal.markPlatformPreLaunch(request.auth!.userId, body?.reason);
  }

  @Get('documents')
  documents() {
    return this.legal.listDocuments('PLATFORM', null);
  }

  @Post('documents')
  async publishDocument(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    const state = await this.legal.platformState();
    if (!state || state.status !== 'PRE_LAUNCH') {
      throw new ConflictException('Новые версии юридических документов платформы публикуются только в PRE_LAUNCH');
    }
    return this.legal.publishDocument(request.auth!.userId, { ...body, scope: 'PLATFORM', tenantId: null });
  }

  @Get('document-history')
  documentHistory() {
    return this.legal.documentHistory('PLATFORM', null);
  }

  @Get('events')
  events() {
    return this.legal.legalEvents('PLATFORM', null);
  }

  @Put('retention-policy')
  retentionPolicy(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.legal.saveRetentionPolicy(request.auth!.userId, { ...body, scope: 'PLATFORM', tenantId: null });
  }
}
