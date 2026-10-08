import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepositService } from './deposit.service';

type AuthenticatedRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
};

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly deposits: DepositService) {}

  @Get('deposits')
  listDeposits(@Req() request: AuthenticatedRequest) {
    return this.deposits.list(request.auth!.tenantId);
  }

  @Get('deposits/person/:personKey')
  listPersonDeposits(
    @Req() request: AuthenticatedRequest,
    @Param('personKey') personKey: string,
  ) {
    return this.deposits.list(request.auth!.tenantId, personKey);
  }

  @Post('deposits/fund')
  fundDeposit(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.deposits.fund(request.auth!.tenantId, body);
  }

  @Post('deposits/:depositId/withdraw')
  withdrawDeposit(
    @Req() request: AuthenticatedRequest,
    @Param('depositId') depositId: string,
    @Body() body: unknown,
  ) {
    return this.deposits.withdraw(request.auth!.tenantId, depositId, body);
  }

  @Delete('deposits/program/:programId')
  deleteProgramDeposits(
    @Req() request: AuthenticatedRequest,
    @Param('programId') programId: string,
  ) {
    return this.deposits.hardDeleteProgram(request.auth!.tenantId, programId);
  }

  @Delete('deposits/:depositId')
  deleteDeposit(
    @Req() request: AuthenticatedRequest,
    @Param('depositId') depositId: string,
  ) {
    return this.deposits.hardDelete(request.auth!.tenantId, depositId);
  }
}
