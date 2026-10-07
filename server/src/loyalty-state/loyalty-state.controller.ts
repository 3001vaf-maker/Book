import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoyaltyStateService } from './loyalty-state.service';

type AuthenticatedRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
};

@Controller('loyalty-state')
@UseGuards(JwtAuthGuard)
export class LoyaltyStateController {
  constructor(private readonly loyalty: LoyaltyStateService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.loyalty.get(request.auth!.tenantId);
  }

  @Put()
  update(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.loyalty.update(request.auth!.tenantId, body);
  }
}
