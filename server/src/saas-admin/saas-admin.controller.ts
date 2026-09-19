import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvitationService } from '../invitation/invitation.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { SaasAdminService } from './saas-admin.service';

type AdminRequest = Request & {
  auth?: { userId: string; tenantId: string; role: string };
  platformAdminId?: string;
};

@Controller('saas-admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class SaasAdminController {
  constructor(
    private readonly admin: SaasAdminService,
    private readonly invitations: InvitationService,
  ) {}

  @Get('me')
  me(@Req() request: AdminRequest) {
    return this.admin.me(request.platformAdminId!, request.auth!.userId);
  }

  @Get('profiles')
  profiles() {
    return this.admin.profiles();
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

  @Post('invitations/:id/resend')
  resendInvitation(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.invitations.resendInvitation(request.platformAdminId!, id);
  }

  @Put('tenants/:tenantId/access')
  updateTenantAccess(
    @Param('tenantId') tenantId: string,
    @Body() body: { status?: unknown; capabilities?: unknown },
  ) {
    return this.admin.updateTenantAccess(tenantId, body || {});
  }
}
