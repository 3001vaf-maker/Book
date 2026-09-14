import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { ManualInvitationService } from './manual-invitation.service';

type AdminRequest = Request & { platformAdminId?: string };
type AuthRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('saas-admin/manual-invitations')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ManualInvitationAdminController {
  constructor(private readonly manualInvitations: ManualInvitationService) {}

  @Post()
  create(@Req() request: AdminRequest) {
    return this.manualInvitations.create(request.platformAdminId!);
  }
}

@Controller('manual-invitations')
export class ManualInvitationController {
  constructor(private readonly manualInvitations: ManualInvitationService) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.manualInvitations.inspect(body?.token);
  }

  @Post('accept')
  accept(@Body() body: {
    token?: unknown;
    name?: unknown;
    surname?: unknown;
    phone?: unknown;
    email?: unknown;
    password?: unknown;
  }) {
    return this.manualInvitations.accept(body || {});
  }

  @Post('repair-profile')
  @UseGuards(JwtAuthGuard)
  repairProfile(@Req() request: AuthRequest) {
    return this.manualInvitations.repairProfile(request.auth!.userId, request.auth!.tenantId);
  }
}
