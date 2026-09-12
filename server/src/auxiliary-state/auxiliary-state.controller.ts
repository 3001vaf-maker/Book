import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuxiliaryStateService } from './auxiliary-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('auxiliary-state')
@UseGuards(JwtAuthGuard)
export class AuxiliaryStateController {
  constructor(private readonly auxiliaryState: AuxiliaryStateService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.auxiliaryState.get(request.auth!.tenantId);
  }

  @Post('migrate')
  migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.auxiliaryState.migrate(request.auth!.tenantId, body);
  }

  @Post('migrate/verify')
  verify(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.auxiliaryState.verifyMigration(request.auth!.tenantId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.auxiliaryState.bootstrap(request.auth!.tenantId);
  }

  @Put(':dataset')
  updateDataset(@Req() request: AuthenticatedRequest, @Param('dataset') dataset: string, @Body() body: unknown) {
    return this.auxiliaryState.updateDataset(request.auth!.tenantId, dataset, body);
  }
}
