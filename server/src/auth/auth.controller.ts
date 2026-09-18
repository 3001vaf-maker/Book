import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

type LoginBody = { email?: string; password?: string };
type AuthRequest = Request & { auth?: { userId: string; tenantId: string; role: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginBody) {
    return this.auth.login(body?.email || '', body?.password || '');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthRequest) {
    return this.auth.me(request.auth!.userId, request.auth!.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding-step')
  onboardingStep(@Req() request: AuthRequest, @Body() body: { step?: unknown }) {
    return this.auth.setOnboardingStep(request.auth!.userId, body?.step);
  }

  @UseGuards(JwtAuthGuard)
  @Post('startup-diagnostic')
  startupDiagnostic(
    @Req() request: AuthRequest,
    @Body() body: { stage?: unknown; message?: unknown },
  ) {
    return this.auth.startupDiagnostic(request.auth!.userId, request.auth!.tenantId, body?.stage, body?.message);
  }
}
