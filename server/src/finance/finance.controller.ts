import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinanceService } from './finance.service';

type AuthenticatedRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
};

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.finance.snapshot(request.auth!.tenantId);
  }

  @Put('settlements/:sourceType/:sourceId')
  saveSettlement(
    @Req() request: AuthenticatedRequest,
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string,
    @Body() body: unknown,
  ) {
    const source = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, any> : {};
    return this.finance.saveSettlement(request.auth!.tenantId, sourceType, sourceId, source.settlement ?? source);
  }

  @Post('operations/payment')
  payment(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.recordPayment(request.auth!.tenantId, body);
  }

  @Post('operations/:operationId/refund')
  refund(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    return this.finance.recordRefund(request.auth!.tenantId, operationId, body);
  }

  @Post('operations/:operationId/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    return this.finance.cancelOperation(request.auth!.tenantId, operationId, body);
  }
}
