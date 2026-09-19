import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.access.resolveTenantAccess(request.auth!.tenantId);
  }
}
