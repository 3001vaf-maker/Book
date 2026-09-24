import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformNoticeService } from './platform-notice.service';

type AuthenticatedRequest = Request & { auth?: { platformAccountId: string; tenantId: string; role: string } };

@Controller('platform-notices')
@UseGuards(JwtAuthGuard)
export class PlatformNoticeController {
  constructor(private readonly notices: PlatformNoticeService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.notices.list(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Get('push/configuration')
  pushConfiguration() {
    return this.notices.pushConfiguration();
  }

  @Get('push/subscription')
  pushSubscription(@Req() request: AuthenticatedRequest, @Query('endpoint') endpoint: string) {
    return this.notices.pushSubscriptionState(request.auth!.platformAccountId, endpoint);
  }

  @Get('push/subscription')
  pushSubscription(@Req() request: AuthenticatedRequest, @Query('endpoint') endpoint: string) {
    return this.notices.pushSubscriptionState(request.auth!.platformAccountId, endpoint);
  }

  @Post('push/subscription')
  savePushSubscription(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.notices.savePushSubscription(
      request.auth!.platformAccountId,
      body,
      String(request.headers['user-agent'] || ''),
    );
  }

  @Delete('push/subscription')
  deletePushSubscription(@Req() request: AuthenticatedRequest, @Body() body: { endpoint?: unknown }) {
    return this.notices.deletePushSubscription(request.auth!.platformAccountId, body?.endpoint);
  }

  @Post(':noticeId/read')
  read(@Req() request: AuthenticatedRequest, @Param('noticeId') noticeId: string) {
    return this.notices.markRead(request.auth!.tenantId, request.auth!.platformAccountId, noticeId);
  }
}
