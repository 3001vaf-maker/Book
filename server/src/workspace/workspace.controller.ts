import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';

type AuthenticatedRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('state')
  getState(@Req() request: AuthenticatedRequest) {
    return this.workspace.get(request.auth!.tenantId, request.auth!.userId);
  }

  @Put('state')
  saveState(@Req() request: AuthenticatedRequest, @Body() body: { data?: unknown }) {
    const data = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
    return this.workspace.save(request.auth!.tenantId, request.auth!.userId, data as Record<string, unknown>);
  }
}
