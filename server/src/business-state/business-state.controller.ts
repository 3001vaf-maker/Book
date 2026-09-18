import { Body, ConflictException, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookingLifecycleNotificationService } from '../notification/booking-lifecycle-notification.service';
import { BusinessStateService } from './business-state.service';
import { ClientContactRulesService } from './client-contact-rules.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('business-state')
@UseGuards(JwtAuthGuard)
export class BusinessStateController {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly clientContactRules: ClientContactRulesService,
    private readonly bookingNotifications: BookingLifecycleNotificationService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.businessState.get(request.auth!.tenantId);
  }

  @Post('migrate')
  async migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
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
  async upsertPerson(@Req() request: AuthenticatedRequest, @Param('key') key: string, @Body() body: unknown) {
    await this.clientContactRules.validatePersonUpsert(request.auth!.tenantId, key, body);
    return this.businessState.upsertPerson(request.auth!.tenantId, key, body);
  }

  @Delete('people/:key')
  async deletePerson(@Req() request: AuthenticatedRequest, @Param('key') key: string) {
    return this.businessState.deletePerson(request.auth!.tenantId, key);
  }

  @Put('uei')
  async updateUEI(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    await this.clientContactRules.validateUeiUpdate(request.auth!.tenantId, body);
    return this.businessState.updateUEI(request.auth!.tenantId, body);
  }

  @Put('records/:recordId')
  async upsertRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string, @Body() body: unknown) {
    const tenantId = request.auth!.tenantId;
    const before = await this.bookingNotifications.recordBefore(tenantId, recordId);
    const record = await this.businessState.upsertRecord(tenantId, recordId, body);
    await this.bookingNotifications.afterRecordUpsert(tenantId, before, record).catch(() => null);
    return record;
  }

  @Delete('records/:recordId')
  async deleteRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    return this.businessState.deleteRecord(request.auth!.tenantId, recordId);
  }

  @Delete('records/:recordId/events')
  async deleteRecordEvents(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    return this.businessState.deleteRecordEvents(request.auth!.tenantId, recordId);
  }

  @Put('record-events/:eventId')
  async upsertRecordEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    const tenantId = request.auth!.tenantId;
    const alreadyExisted = await this.bookingNotifications.recordEventExists(tenantId, eventId);
    const event = await this.businessState.upsertRecordEvent(tenantId, eventId, body);
    await this.bookingNotifications.afterRecordEventUpsert(tenantId, event, alreadyExisted).catch(() => null);
    return event;
  }

  @Get('operational')
  operational(@Req() request: AuthenticatedRequest) {
    return this.businessState.getOperational(request.auth!.tenantId);
  }

  @Post('operational/migrate')
  migrateOperational(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.migrateOperational(request.auth!.tenantId, body);
  }

  @Post('operational/migrate/verify')
  verifyOperational(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.businessState.verifyOperationalMigration(request.auth!.tenantId, body);
  }

  @Post('operational/bootstrap')
  bootstrapOperational(@Req() request: AuthenticatedRequest) {
    return this.businessState.bootstrapOperational(request.auth!.tenantId);
  }

  @Put('operational/:dataset')
  updateOperational(@Req() request: AuthenticatedRequest, @Param('dataset') dataset: string, @Body() body: unknown) {
    return this.businessState.updateOperationalDataset(request.auth!.tenantId, dataset, body);
  }
}
