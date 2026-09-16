import { Body, Controller, ConflictException, ForbiddenException, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LegalRuntimeService } from './legal-runtime.service';

type AuthRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('legal')
@UseGuards(JwtAuthGuard)
export class TenantLegalController {
  constructor(private readonly legal: LegalRuntimeService) {}

  private owner(request: AuthRequest) {
    if (request.auth?.role !== 'OWNER') throw new ForbiddenException('Юридические настройки доступны владельцу Tenant');
    return request.auth;
  }

  @Get('readiness')
  readiness(@Req() request: AuthRequest) {
    return this.legal.tenantReadiness(request.auth!.tenantId);
  }

  @Put('checklist')
  checklist(@Req() request: AuthRequest, @Body() body: { checklist?: unknown }) {
    const auth = this.owner(request);
    return this.legal.updateTenantChecklist(auth.tenantId, auth.userId, body?.checklist || {});
  }

  @Post('filing/prepared')
  prepared(@Req() request: AuthRequest) {
    const auth = this.owner(request);
    return this.legal.markTenantPrepared(auth.tenantId, auth.userId);
  }

  @Post('filing/submitted')
  submitted(@Req() request: AuthRequest, @Body() body: { submissionReference?: unknown; evidenceMetadata?: unknown }) {
    const auth = this.owner(request);
    return this.legal.confirmTenantSubmitted(auth.tenantId, auth.userId, body || {});
  }

  @Post('live')
  live(@Req() request: AuthRequest) {
    const auth = this.owner(request);
    return this.legal.activateTenantLive(auth.tenantId, auth.userId);
  }

  @Post('demo')
  demo(@Req() request: AuthRequest, @Body() body: { reason?: unknown }) {
    const auth = this.owner(request);
    return this.legal.returnTenantToDemo(auth.tenantId, auth.userId, body?.reason);
  }

  @Get('documents')
  documents(@Req() request: AuthRequest) {
    return this.legal.listDocuments('TENANT', request.auth!.tenantId);
  }

  @Post('documents')
  async publishDocument(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    const auth = this.owner(request);
    const state = await this.legal.tenantState(auth.tenantId);
    if (!state || state.operationMode !== 'DEMO') {
      throw new ConflictException('Новые версии юридических документов мастера публикуются только в DEMO');
    }
    return this.legal.publishDocument(auth.userId, { ...body, scope: 'TENANT', tenantId: auth.tenantId });
  }

  @Get('events')
  events(@Req() request: AuthRequest) {
    return this.legal.legalEvents('TENANT', request.auth!.tenantId);
  }

  @Get('subject-requests')
  subjectRequests(@Req() request: AuthRequest) {
    return this.legal.listDataSubjectRequests(request.auth!.tenantId);
  }

  @Post('subject-requests')
  createSubjectRequest(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    const auth = this.owner(request);
    return this.legal.createDataSubjectRequest(auth.tenantId, auth.userId, body || {});
  }

  @Put('retention-policy')
  retentionPolicy(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    const auth = this.owner(request);
    return this.legal.saveRetentionPolicy(auth.userId, { ...body, scope: 'TENANT', tenantId: auth.tenantId });
  }
}
