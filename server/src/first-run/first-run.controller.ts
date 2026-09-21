import { Body, Controller, Get, Param, Post, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FirstRunService } from './first-run.service';

type AuthenticatedRequest = Request & { auth?: { platformAccountId: string; tenantId: string; role: string } };

@Controller('first-run')
@UseGuards(JwtAuthGuard)
export class FirstRunController {
  constructor(private readonly firstRun: FirstRunService) {}

  @Get('state')
  state(@Req() request: AuthenticatedRequest) {
    return this.firstRun.state(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Get('rkn-guide.pdf')
  async rknGuide(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.firstRun.rknGuide(request.auth!.tenantId, request.auth!.platformAccountId);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="rkn-guide.pdf"',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(pdf);
  }

  @Post('steps/:stepKey/seen')
  seen(
    @Req() request: AuthenticatedRequest,
    @Param('stepKey') stepKey: string,
    @Body() body: { sessionId?: unknown },
  ) {
    return this.firstRun.markModalSeen(
      request.auth!.tenantId,
      request.auth!.platformAccountId,
      stepKey,
      String(body?.sessionId || ''),
    );
  }

  @Post('steps/:stepKey/complete')
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('stepKey') stepKey: string,
    @Body() body: { action?: unknown; sessionId?: unknown },
  ) {
    return this.firstRun.completeStep(
      request.auth!.tenantId,
      request.auth!.platformAccountId,
      stepKey,
      body?.action,
      String(body?.sessionId || ''),
    );
  }

  @Post('session/start')
  sessionStart(@Req() request: AuthenticatedRequest) {
    return this.firstRun.startSession(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Post('session/:sessionId/heartbeat')
  heartbeat(@Req() request: AuthenticatedRequest, @Param('sessionId') sessionId: string) {
    return this.firstRun.heartbeat(request.auth!.tenantId, request.auth!.platformAccountId, sessionId);
  }

  @Post('session/:sessionId/end')
  sessionEnd(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: { reason?: unknown },
  ) {
    return this.firstRun.endSession(
      request.auth!.tenantId,
      request.auth!.platformAccountId,
      sessionId,
      body?.reason,
    );
  }

  @Post('requests/live')
  requestLive(@Req() request: AuthenticatedRequest) {
    return this.firstRun.requestLive(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Post('requests/demo-extension')
  requestDemoExtension(@Req() request: AuthenticatedRequest) {
    return this.firstRun.requestDemoExtension(request.auth!.tenantId, request.auth!.platformAccountId);
  }

  @Post('activity')
  activity(
    @Req() request: AuthenticatedRequest,
    @Body() body: {
      eventType?: unknown;
      stepKey?: unknown;
      scenarioVersionId?: unknown;
      metadata?: unknown;
      sessionId?: unknown;
    },
  ) {
    return this.firstRun.recordActivity(
      request.auth!.tenantId,
      request.auth!.platformAccountId,
      body || {},
    );
  }
}
