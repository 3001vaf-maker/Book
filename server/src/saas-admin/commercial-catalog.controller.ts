import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { CommercialCatalogService } from './commercial-catalog.service';

type AdminRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
  platformAdminId?: string;
};

@Controller('saas-admin/commercial-catalog')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class CommercialCatalogController {
  constructor(private readonly catalog: CommercialCatalogService) {}

  @Get()
  list() {
    return this.catalog.catalog();
  }

  @Put(':key')
  update(
    @Req() request: AdminRequest,
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.catalog.updateProduct(key, body || {}, request.platformAdminId!);
  }

  @Post('packages')
  createPackage(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.catalog.createPackage(body || {}, request.platformAdminId!);
  }

  @Post('publish')
  publish(@Req() request: AdminRequest) {
    return this.catalog.publish(request.platformAdminId!);
  }

  @Get('audit/events')
  audit(@Query('limit') limit?: string) {
    return this.catalog.auditEvents(limit);
  }
}
