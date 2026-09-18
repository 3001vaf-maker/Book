import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';

type OwnerRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get('routing')
  routing(@Req() request: OwnerRequest) {
    return this.notifications.listRoutingPolicies(request.auth!.tenantId);
  }

  @Put('routing/:eventType')
  saveRouting(
    @Req() request: OwnerRequest,
    @Param('eventType') eventType: string,
    @Body() body: { mode?: unknown; channels?: unknown },
  ) {
    return this.notifications.saveRoutingPolicy(request.auth!.tenantId, eventType, body || {});
  }
}
