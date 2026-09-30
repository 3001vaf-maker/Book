import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaasAccessService } from './saas-access.service';

type AuthenticatedRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
};

@Controller('saas-access')
@UseGuards(JwtAuthGuard)
export class SaasAccessController {
  constructor(private readonly access: SaasAccessService) {}

  @Post('demo/activate')
  activateDemo(@Req() request: AuthenticatedRequest) {
    return this.access.activateDemo(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Post('requests/live')
  requestLive(@Req() request: AuthenticatedRequest) {
    return this.access.requestLive(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.access.resolveTenantAccess(request.auth!.tenantId);
  }
}
