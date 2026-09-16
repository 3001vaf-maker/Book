import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { AuxiliaryStateService } from './auxiliary-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('auxiliary-state')
@UseGuards(JwtAuthGuard)
export class AuxiliaryStateController {
  constructor(
    private readonly auxiliaryState: AuxiliaryStateService,
    private readonly legal: LegalRuntimeService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.auxiliaryState.get(request.auth!.tenantId);
  }

  @Post('migrate')
  async migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    await this.legal.assertTenantLive(request.auth!.tenantId, request.auth!.userId, 'AUXILIARY_REAL_DATA_MIGRATION');
    return this.auxiliaryState.migrate(request.auth!.tenantId, body);
  }

  @Post('migrate/verify')
  async verify(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    await this.legal.assertTenantLive(request.auth!.tenantId, request.auth!.userId, 'AUXILIARY_REAL_DATA_MIGRATION_VERIFY');
    return this.auxiliaryState.verifyMigration(request.auth!.tenantId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.auxiliaryState.bootstrap(request.auth!.tenantId);
  }

  @Put(':dataset')
  async updateDataset(@Req() request: AuthenticatedRequest, @Param('dataset') dataset: string, @Body() body: unknown) {
    if (String(dataset || '').trim() === 'finance') {
      await this.legal.assertTenantLive(request.auth!.tenantId, request.auth!.userId, 'FINANCE_MUTATION');
    }
    return this.auxiliaryState.updateDataset(request.auth!.tenantId, dataset, body);
  }
}
