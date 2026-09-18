import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { ConsentPolicyService } from '../document-state/consent-policy.service';
import { PrismaService } from '../prisma.service';

type AccountRequest = Request & {
  bookingAccountAuth?: { accountId: string; tenantId: string };
  bookingConsentAccess?: unknown;
};

@Injectable()
export class BookingRequiredConsentGuard implements CanActivate {
  constructor(
    private readonly consentPolicy: ConsentPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    const auth = request.bookingAccountAuth;
    if (!auth) throw new ForbiddenException('Не определён аккаунт онлайн-записи');

    const access = await this.prisma.tenantAccess.findUnique({
      where: { tenantId: auth.tenantId },
      select: { isOwnerBook: true },
    });
    if (access?.isOwnerBook) {
      request.bookingConsentAccess = { allowed: true, consents: [], runtimeChecksDisabled: true };
      return true;
    }

    const state = await this.consentPolicy.requiredConsentState(auth.tenantId, auth.accountId);
    request.bookingConsentAccess = state;
    if (!state.allowed) {
      throw new ForbiddenException({
        code: 'CONSENT_REQUIRED',
        message: 'Необходимо заново подтвердить обязательные документы',
        ...state,
      });
    }

    const derivedConsents = state.consents.map((item) => ({
      documentId: item.documentId,
      documentVersion: item.documentVersion,
      accepted: Boolean(item.accepted),
      acceptedAt: item.accepted ? item.eventAt : '',
      status: item.status,
    })) as Prisma.InputJsonValue;
    await this.prisma.bookingAccount.updateMany({
      where: { id: auth.accountId, tenantId: auth.tenantId },
      data: { consents: derivedConsents },
    });

    return true;
  }
}
