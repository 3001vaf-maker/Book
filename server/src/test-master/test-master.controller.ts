import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { TestMasterService } from './test-master.service';

type AdminRequest = Request & {
  auth?: { userId: string; tenantId: string; role: string };
  platformAdminId?: string;
};

@Controller('saas-admin/test-masters')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class TestMasterAdminController {
  constructor(private readonly tests: TestMasterService) {}

  @Get()
  list() {
    return this.tests.list();
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() body: { name?: unknown }) {
    return this.tests.create(request.platformAdminId!, body || {});
  }

  @Delete(':tenantId')
  remove(@Req() request: AdminRequest, @Param('tenantId') tenantId: string) {
    return this.tests.remove(tenantId, request.auth!.userId);
  }
}

@Controller('test-master-invitations')
export class TestMasterInvitationController {
  constructor(private readonly tests: TestMasterService) {}

  @Post('inspect')
  inspect(@Body() body: { token?: unknown }) {
    return this.tests.inspect(body?.token);
  }

  @Post('documents')
  documents(@Body() body: { token?: unknown }) {
    return this.tests.documents(body?.token);
  }

  @Post('accept')
  accept(
    @Req() request: Request,
    @Body() body: {
      token?: unknown;
      password?: unknown;
      saasAgreementAccepted?: unknown;
      dpaAccepted?: unknown;
      privacyAcknowledged?: unknown;
      pdConsentAccepted?: unknown;
      marketingConsentAccepted?: unknown;
    },
  ) {
    return this.tests.accept({
      ...(body || {}),
      technicalEvidence: {
        ip: request.ip || '',
        userAgent: request.headers['user-agent'] || '',
      },
    });
  }
}
