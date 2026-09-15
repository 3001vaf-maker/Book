import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaasAccessService } from './saas-access.service';

type AuthenticatedRequest = Request & {
  auth?: { userId: string; tenantId: string; role: string };
};

@Controller('saas-access')
@UseGuards(JwtAuthGuard)
export class SaasAccessController {
  constructor(private readonly access: SaasAccessService) {}

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.access.resolveTenantAccess(request.auth!.tenantId);
  }

  @Get('changes')
  changes(@Req() request: AuthenticatedRequest) {
    return this.access.pendingCapabilityChanges(request.auth!.tenantId);
  }

  @Post('changes/:batchId/ack-summary')
  acknowledgeSummary(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string) {
    return this.access.acknowledgeCapabilitySummary(request.auth!.tenantId, batchId);
  }

  @Post('changes/events/:eventId/ack-detail')
  acknowledgeDetail(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string) {
    return this.access.acknowledgeCapabilityIntroduction(request.auth!.tenantId, eventId);
  }
}
