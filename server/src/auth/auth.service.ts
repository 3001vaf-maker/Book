import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { memberships: { include: { tenant: true } } },
    });
    if (!user || !(await compare(String(password || ''), user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException('Пользователь не привязан к бизнесу');

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: membership.tenantId,
      role: membership.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        onboardingStep: user.onboardingStep,
        workspaceUnlocked: user.workspaceUnlocked,
      },
      tenant: { id: membership.tenant.id, name: membership.tenant.name },
      role: membership.role,
    };
  }

  async me(userId: string, tenantId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { user: true, tenant: true },
    });
    if (!membership) throw new UnauthorizedException();

    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        onboardingStep: membership.user.onboardingStep,
        workspaceUnlocked: membership.user.workspaceUnlocked,
      },
      tenant: { id: membership.tenant.id, name: membership.tenant.name },
      role: membership.role,
    };
  }
  async setOnboardingStep(userId: string, stepValue: unknown) {
    const parsed = Number(stepValue);
    const step = Number.isInteger(parsed) ? Math.max(0, Math.min(20, parsed)) : 0;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: step },
      select: { id: true, email: true, onboardingStep: true, workspaceUnlocked: true },
    });
    return { user };
  }

  startupDiagnostic(userId: string, tenantId: string, stageValue: unknown, messageValue: unknown) {
    const stage = String(stageValue || 'unknown').trim().slice(0, 80) || 'unknown';
    const message = String(messageValue || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    this.logger.warn(`Workspace startup failed tenant=${tenantId} user=${userId} stage=${stage} message=${message || 'unknown'}`);
    return { received: true };
  }

}
