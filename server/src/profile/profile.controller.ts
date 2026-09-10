import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.profile.get(request.auth!.tenantId, request.auth!.userId);
  }

  @Post('migrate')
  migrate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.profile.migrate(request.auth!.tenantId, request.auth!.userId, body);
  }

  @Post('migrate/verify')
  verifyMigration(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.profile.verifyMigration(request.auth!.tenantId, request.auth!.userId, body);
  }

  @Post('bootstrap')
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.profile.bootstrap(request.auth!.tenantId, request.auth!.userId);
  }

  @Put()
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.profile.updateProfile(request.auth!.tenantId, request.auth!.userId, body);
  }

  @Put('workplaces/:key')
  upsertWorkplace(
    @Req() request: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() body: unknown,
  ) {
    return this.profile.upsertWorkplace(request.auth!.tenantId, request.auth!.userId, key, body);
  }

  @Delete('workplaces/:key')
  deleteWorkplace(@Req() request: AuthenticatedRequest, @Param('key') key: string) {
    return this.profile.deleteWorkplace(request.auth!.tenantId, request.auth!.userId, key);
  }
}
