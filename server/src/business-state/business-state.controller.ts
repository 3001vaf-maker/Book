import { Body, ConflictException, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { BookingLifecycleNotificationService } from '../notification/booking-lifecycle-notification.service';
import { BusinessStateService } from './business-state.service';
import { ClientContactRulesService } from './client-contact-rules.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

const SYNTHETIC_DEMO_CLIENTS = [
  { key: 'demo-client-anna', name: 'Анна', surname: 'Демо', synthetic: true, accounts: [], phones: [], emails: [], telegrams: [] },
  { key: 'demo-client-mikhail', name: 'Михаил', surname: 'Демо', synthetic: true, accounts: [], phones: [], emails: [], telegrams: [] },
  { key: 'demo-client-elena', name: 'Елена', surname: 'Демо', synthetic: true, accounts: [], phones: [], emails: [], telegrams: [] },
] as const;

@Controller('business-state')
@UseGuards(JwtAuthGuard)
export class BusinessStateController {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly clientContactRules: ClientContactRulesService,
    private readonly bookingNotifications: BookingLifecycleNotificationService,
    private readonly legal: LegalRuntimeService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.businessState.get(request.auth!.tenantId);
  }

  @Post('migrate')
  async migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
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

  @Post('demo/clients/seed')
  async seedSyntheticDemoClients(@Req() request: AuthenticatedRequest) {
    const tenantId = request.auth!.tenantId;
    const userId = request.auth!.userId;
    await this.legal.assertTenantActive(tenantId, userId, 'DEMO_SYNTHETIC_CLIENTS');
    const state = await this.legal.tenantState(tenantId);
    if (!state || state.operationMode !== 'DEMO') {
      throw new ConflictException('Синтетические demo-клиенты доступны только в DEMO');
    }
    await this.businessState.bootstrap(tenantId);
    const people = [];
    for (const [position, person] of SYNTHETIC_DEMO_CLIENTS.entries()) {
      people.push(await this.businessState.upsertPerson(tenantId, person.key, { position, person }));
    }
    await this.legal.audit(tenantId, userId, 'DEMO_SYNTHETIC_CLIENTS_SEEDED', 'DEMO', 'SUCCESS', { count: people.length });
    return { synthetic: true, people };
  }

  @Put('people/:key')
  async upsertPerson(@Req() request: AuthenticatedRequest, @Param('key') key: string, @Body() body: unknown) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    await this.clientContactRules.validatePersonUpsert(request.auth!.tenantId, key, body);
    return this.businessState.upsertPerson(request.auth!.tenantId, key, body);
  }

  @Delete('people/:key')
  async deletePerson(@Req() request: AuthenticatedRequest, @Param('key') key: string) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.businessState.deletePerson(request.auth!.tenantId, key);
  }

  @Put('uei')
  async updateUEI(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    await this.clientContactRules.validateUeiUpdate(request.auth!.tenantId, body);
    return this.businessState.updateUEI(request.auth!.tenantId, body);
  }

  @Put('records/:recordId')
  async upsertRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string, @Body() body: unknown) {
    const tenantId = request.auth!.tenantId;
    await this.legal.assertRealClientMutation(tenantId, request.auth!.userId);
    const before = await this.bookingNotifications.recordBefore(tenantId, recordId);
    const record = await this.businessState.upsertRecord(tenantId, recordId, body);
    await this.bookingNotifications.afterRecordUpsert(tenantId, before, record).catch(() => null);
    return record;
  }

  @Delete('records/:recordId')
  async deleteRecord(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.businessState.deleteRecord(request.auth!.tenantId, recordId);
  }

  @Delete('records/:recordId/events')
  async deleteRecordEvents(@Req() request: AuthenticatedRequest, @Param('recordId') recordId: string) {
    await this.legal.assertRealClientMutation(request.auth!.tenantId, request.auth!.userId);
    return this.businessState.deleteRecordEvents(request.auth!.tenantId, recordId);
  }

  @Put('record-events/:eventId')
  async upsertRecordEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    const tenantId = request.auth!.tenantId;
    await this.legal.assertRealClientMutation(tenantId, request.auth!.userId);
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
