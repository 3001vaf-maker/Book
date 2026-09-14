import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MasterInvitationStatus,
  MembershipRole,
  TenantAccessStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { hash as hashPassword } from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { MasterInvitationService } from '../master-invitation/master-invitation.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MANUAL_EMAIL_PREFIX = 'manual+';
const MANUAL_EMAIL_SUFFIX = '@book.invalid';
const DEFAULT_CLIENT_APP_URL = 'https://3001vaf-maker.github.io/Book';

function text(value: unknown) {
  return String(value || '').trim();
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function invitationHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return randomBytes(32).toString('base64url');
}

function isManualEmail(email: string) {
  return email.startsWith(MANUAL_EMAIL_PREFIX) && email.endsWith(MANUAL_EMAIL_SUFFIX);
}

@Injectable()
export class ManualInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: MasterInvitationService,
    private readonly jwt: JwtService,
  ) {}

  async create(adminId: string) {
    const plan = await this.invitations.ensureStarterPlan();
    const token = createToken();
    const tokenHash = invitationHash(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const placeholderEmail = `${MANUAL_EMAIL_PREFIX}${tokenHash.slice(0, 24)}${MANUAL_EMAIL_SUFFIX}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: 'Новый мастер' } });
      await tx.tenantAccess.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: TenantAccessStatus.ACTIVE,
          isOwnerBook: false,
        },
      });
      const invitation = await tx.masterInvitation.create({
        data: {
          tenantId: tenant.id,
          createdByAdminId: adminId,
          email: placeholderEmail,
          name: '',
          tokenHash,
          expiresAt,
        },
      });
      return { tenant, invitation };
    });

    const origin = String(
      process.env.CLIENT_APP_URL || DEFAULT_CLIENT_APP_URL,
    ).trim().replace(/\/+$/, '');

    return {
      id: created.invitation.id,
      tenantId: created.tenant.id,
      url: `${origin}/register/?token=${encodeURIComponent(token)}`,
      expiresAt,
    };
  }

  async inspect(tokenValue: unknown) {
    const invitation = await this.findManualInvitation(text(tokenValue));
    return { expiresAt: invitation.expiresAt };
  }

  async accept(input: {
    token?: unknown;
    name?: unknown;
    surname?: unknown;
    phone?: unknown;
    email?: unknown;
    password?: unknown;
  }) {
    const token = text(input?.token);
    const name = text(input?.name);
    const surname = text(input?.surname);
    const phone = text(input?.phone);
    const email = normalizeEmail(input?.email);
    const password = String(input?.password || '');

    if (!name) throw new BadRequestException('Укажите имя');
    if (!surname) throw new BadRequestException('Укажите фамилию');
    if (!phone) throw new BadRequestException('Укажите телефон');
    if (!email || !email.includes('@')) throw new BadRequestException('Укажите корректный email');
    if (password.length < 10) throw new BadRequestException('Пароль должен содержать минимум 10 символов');

    const invitation = await this.findManualInvitation(token);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    const passwordHash = await hashPassword(password, 12);
    const fullName = `${name} ${surname}`.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          onboardingStep: 0,
          workspaceUnlocked: false,
        },
      });
      const membership = await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });
      await tx.profile.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          key: 'profile',
          name,
          surname,
          phone,
          phones: [phone],
          telegrams: [],
          emails: [email],
          about: '',
          photo: '',
          profession: '',
          experience: '',
          professionAbout: '',
          customProfessions: [],
        },
      });
      await tx.tenant.update({
        where: { id: invitation.tenantId },
        data: { name: fullName },
      });
      await tx.masterInvitation.update({
        where: { id: invitation.id },
        data: {
          email,
          name: fullName,
          status: MasterInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });
      return { user, membership };
    });

    const accessToken = await this.jwt.signAsync({
      sub: result.user.id,
      tenantId: invitation.tenantId,
      role: result.membership.role,
    });

    return {
      accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        onboardingStep: result.user.onboardingStep,
        workspaceUnlocked: result.user.workspaceUnlocked,
      },
      tenant: { id: invitation.tenantId, name: fullName },
      role: result.membership.role,
    };
  }

  private async findManualInvitation(token: string) {
    if (!token) throw new BadRequestException('Ссылка регистрации недействительна');
    const invitation = await this.prisma.masterInvitation.findUnique({
      where: { tokenHash: invitationHash(token) },
      include: { tenant: true },
    });
    if (!invitation || !isManualEmail(invitation.email)) {
      throw new NotFoundException('Ссылка регистрации не найдена');
    }
    if (invitation.status !== MasterInvitationStatus.PENDING) {
      throw new ConflictException('Эта ссылка уже использована');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Срок действия ссылки истёк');
    }
    return invitation;
  }
}
