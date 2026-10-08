import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinanceService } from '../finance/finance.service';
import { SettlementService } from './settlement.service';

type AuthenticatedRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
};

@Controller('settlement')
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(
    private readonly settlement: SettlementService,
    private readonly finance: FinanceService,
  ) {}

  @Get('sources/:personKey')
  sources(@Req() request: AuthenticatedRequest, @Param('personKey') personKey: string) {
    return this.settlement.sources(request.auth!.tenantId, personKey);
  }

  @Post('operations/payment')
  payment(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.settlement.recordPayment(request.auth!.tenantId, body);
  }

  @Post('operations/:operationId/refund')
  refund(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    return this.settlement.recordRefund(request.auth!.tenantId, operationId, body);
  }

  @Put('operations/:operationId')
  async correct(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    const tenantId = request.auth!.tenantId;
    const kind = await this.settlement.operationKind(tenantId, operationId);
    if (kind === 'payment') return this.settlement.correctPayment(tenantId, operationId, body);
    if (kind === 'refund') return this.settlement.correctRefund(tenantId, operationId, body);
    return this.finance.correctOperation(tenantId, operationId, body);
  }

  @Post('operations/:operationId/cancel')
  async cancel(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    const tenantId = request.auth!.tenantId;
    const kind = await this.settlement.operationKind(tenantId, operationId);
    if (kind === 'payment') return this.settlement.cancelPaymentTree(tenantId, operationId, body);
    if (kind === 'refund') return this.settlement.cancelRefund(tenantId, operationId, body);
    return this.finance.cancelOperation(tenantId, operationId, body);
  }

  @Delete('operations/:operationId/hard')
  async hardDelete(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
  ) {
    const tenantId = request.auth!.tenantId;
    const kind = await this.settlement.operationKind(tenantId, operationId);
    if (kind === 'payment' || kind === 'refund' || kind === 'cancel') {
      return this.settlement.hardDeleteSettlementOperation(tenantId, operationId);
    }
    return this.finance.hardDeleteOperation(tenantId, operationId);
  }
}
