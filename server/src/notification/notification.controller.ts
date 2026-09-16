import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { NotificationTemplateService } from './notification-template.service';

type OwnerRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly templates: NotificationTemplateService,
  ) {}

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

  @Get('templates')
  templatesList(@Req() request: OwnerRequest, @Query('audience') audience = '') {
    return this.templates.list(request.auth!.tenantId, audience);
  }

  @Put('templates/:templateKey')
  saveTemplate(
    @Req() request: OwnerRequest,
    @Param('templateKey') templateKey: string,
    @Body() body: { title?: unknown; body?: unknown },
  ) {
    return this.templates.save(request.auth!.tenantId, templateKey, body || {});
  }
}
