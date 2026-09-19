import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const account = await this.prisma.platformAccount.findUnique({
      where: { email: normalizedEmail },
      include: { memberships: { include: { tenant: true } } },
    });
    if (!account || !(await compare(String(password || ''), account.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const membership = account.memberships[0];
    if (!membership) throw new UnauthorizedException('Учётная запись не привязана к пространству');

    const accessToken = await this.jwt.signAsync({
      sub: account.id,
      tenantId: membership.tenantId,
      role: membership.role,
    });

    return {
      accessToken,
      account: {
        id: account.id,
        email: account.email,
        onboardingStep: account.onboardingStep,
        workspaceUnlocked: account.workspaceUnlocked,
      },
      tenant: { id: membership.tenant.id, name: membership.tenant.name },
      role: membership.role,
    };
  }

  async me(platformAccountId: string, tenantId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_platformAccountId: { tenantId, platformAccountId } },
      include: { account: true, tenant: true },
    });
    if (!membership) throw new UnauthorizedException();

    return {
      account: {
        id: membership.account.id,
        email: membership.account.email,
        onboardingStep: membership.account.onboardingStep,
        workspaceUnlocked: membership.account.workspaceUnlocked,
      },
      tenant: { id: membership.tenant.id, name: membership.tenant.name },
      role: membership.role,
    };
  }
}
