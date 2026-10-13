import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessengerCoreService } from './messenger-core.service';

type OwnerRequest = Request & { auth?: { platformAccountId: string; tenantId: string; role: string } };

@Controller('communications/messenger')
export class ProfessionalMessengerController {
  constructor(private readonly messenger: MessengerCoreService) {}

  @UseGuards(JwtAuthGuard)
  @Post('direct')
  ensureDirect(
    @Req() request: OwnerRequest,
    @Body() body: { phone?: unknown; uei?: unknown },
  ) {
    return this.messenger.ensureDirect(request.auth!.tenantId, body || {});
  }
}
