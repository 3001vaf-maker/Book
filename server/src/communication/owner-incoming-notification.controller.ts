import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnerIncomingNotificationService } from './owner-incoming-notification.service';

type OwnerRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('communications/incoming')
@UseGuards(JwtAuthGuard)
export class OwnerIncomingNotificationController {
  constructor(private readonly incoming: OwnerIncomingNotificationService) {}

  @Get('unread')
  unread(@Req() request: OwnerRequest) {
    return this.incoming.summary(request.auth!.tenantId);
  }

  @Post('thread/read')
  markThreadRead(
    @Req() request: OwnerRequest,
    @Body() body: { profileKey?: unknown; phone?: unknown; uei?: unknown },
  ) {
    return this.incoming.markThreadRead(request.auth!.tenantId, body || {});
  }
}
