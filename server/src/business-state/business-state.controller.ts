import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessStateService } from './business-state.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('business-state')
@UseGuards(JwtAuthGuard)
export class BusinessStateController {
  constructor(private readonly businessState: BusinessStateService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.businessState.get(request.auth!.tenantId);
  }

  @Post('migrate')
  migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.migrate(request.auth!.tenantId, body);
  }

  @Post('migrate/verify')
  verify(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.verifyMigration(request.auth!.tenantId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.businessState.bootstrap(request.auth!.tenantId);
  }

  @Put('people/:key')
  upsertPerson(@Req() request: AuthenticatedRequest, @Param('key') key: string, @Body() body: unknown) {
    return this.businessState.upsertPerson(request.auth!.tenantId, key, body);
  }

  @Delete('people/:key')
  deletePerson(@Req() request: AuthenticatedRequest, @Param('key') key: string) {
    return this.businessState.deletePerson(request.auth!.tenantId, key);
  }

  @Put('uei')
  updateUEI(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.updateUEI(request.auth!.tenantId, body);
  }

  @Put('records/:recordId')
  upsertRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string, @Body() body: unknown) {
    return this.businessState.upsertRecord(request.auth!.tenantId, recordId, body);
  }

  @Delete('records/:recordId')
  deleteRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    return this.businessState.deleteRecord(request.auth!.tenantId, recordId);
  }

  @Delete('records/:recordId/events')
  deleteRecordEvents(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    return this.businessState.deleteRecordEvents(request.auth!.tenantId, recordId);
  }

  @Put('record-events/:eventId')
  upsertRecordEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    return this.businessState.upsertRecordEvent(request.auth!.tenantId, eventId, body);
  }
}
