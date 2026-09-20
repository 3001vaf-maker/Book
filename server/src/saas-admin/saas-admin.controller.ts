import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantInvitationService } from '../tenant-invitation/tenant-invitation.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { SaasAdminService } from './saas-admin.service';

type AdminRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
  platformAdminId?: string;
};

@Controller('saas-admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class SaasAdminController {
  constructor(
    private readonly admin: SaasAdminService,
    private readonly invitations: TenantInvitationService,
  ) {}

  @Get('me')
  me(@Req() request: AdminRequest) {
    return this.admin.me(request.platformAdminId!, request.auth!.platformAccountId);
  }

  @Get('tenants')
  tenants() {
    return this.admin.tenants();
  }

  @Get('capabilities')
  capabilities() {
    return this.admin.capabilities();
  }

  @Get('document-registry/history')
  documentRegistryHistory() {
    return this.admin.documentRegistryHistory();
  }

  @Get('invitations')
  listInvitations(@Req() request: AdminRequest) {
    return this.invitations.listInvitations(request.platformAdminId!);
  }

  @Post('invitations')
  createInvitation(
    @Req() request: AdminRequest,
    @Body() body: { email?: unknown; name?: unknown },
  ) {
    return this.invitations.createInvitation(request.platformAdminId!, body || {});
  }

  @Post('invitations/link')
  createRegistrationLink(@Req() request: AdminRequest) {
    return this.invitations.createRegistrationLink(request.platformAdminId!);
  }

  @Post('invitations/:id/resend')
  resendInvitation(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.invitations.resendInvitation(request.platformAdminId!, id);
  }

  @Post('tenants/:tenantId/technical-email')
  sendTechnicalEmail(
    @Param('tenantId') tenantId: string,
    @Body() body: { subject?: unknown; body?: unknown },
  ) {
    return this.admin.sendTechnicalEmail(tenantId, body || {});
  }

  @Put('tenants/:tenantId/access')
  updateTenantAccess(
    @Param('tenantId') tenantId: string,
    @Body() body: { status?: unknown; capabilities?: unknown },
  ) {
    return this.admin.updateTenantAccess(tenantId, body || {});
  }
}
