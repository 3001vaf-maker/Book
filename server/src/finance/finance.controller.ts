import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
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

  @Get('deposits')
  deposits(@Req() request: AuthenticatedRequest) {
    return this.finance.listDeposits(request.auth!.tenantId);
  }

  @Get('deposits/person/:personKey')
  personDeposits(
    @Req() request: AuthenticatedRequest,
    @Param('personKey') personKey: string,
  ) {
    return this.finance.listDeposits(request.auth!.tenantId, personKey);
  }

  @Post('deposits/fund')
  fundDeposit(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.recordDepositFunding(request.auth!.tenantId, body);
  }

  @Post('deposits/:depositId/withdraw')
  withdrawDeposit(
    @Req() request: AuthenticatedRequest,
    @Param('depositId') depositId: string,
    @Body() body: unknown,
  ) {
    return this.finance.recordDepositWithdrawal(request.auth!.tenantId, depositId, body);
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

  @Get('articles')
  articles(@Req() request: AuthenticatedRequest) {
    return this.finance.listArticles(request.auth!.tenantId);
  }

  @Post('articles')
  createArticle(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.createArticle(request.auth!.tenantId, body);
  }

  @Put('articles/:articleId')
  updateArticle(
    @Req() request: AuthenticatedRequest,
    @Param('articleId') articleId: string,
    @Body() body: unknown,
  ) {
    return this.finance.updateArticle(request.auth!.tenantId, articleId, body);
  }

  @Delete('articles/:articleId')
  archiveArticle(
    @Req() request: AuthenticatedRequest,
    @Param('articleId') articleId: string,
  ) {
    return this.finance.archiveArticle(request.auth!.tenantId, articleId);
  }

  @Delete('wallets/:walletId/hard')
  hardDeleteWallet(
    @Req() request: AuthenticatedRequest,
    @Param('walletId') walletId: string,
  ) {
    return this.finance.hardDeleteWallet(
      request.auth!.tenantId,
      request.auth!.platformAccountId,
      walletId,
    );
  }

  @Post('operations/manual')
  manual(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.recordManualOperation(request.auth!.tenantId, body);
  }

  @Post('operations/special')
  special(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.finance.recordSpecialOperation(request.auth!.tenantId, body);
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

  @Put('operations/:operationId')
  correctOperation(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    return this.finance.correctOperation(request.auth!.tenantId, operationId, body);
  }

  @Delete('operations/:operationId/hard')
  hardDeleteOperation(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
  ) {
    return this.finance.hardDeleteOperation(request.auth!.tenantId, operationId);
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
