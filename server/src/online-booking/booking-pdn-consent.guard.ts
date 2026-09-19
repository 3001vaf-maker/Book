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
export class BookingPdnConsentGuard implements CanActivate {
  constructor(
    private readonly consentPolicy: ConsentPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    const auth = request.bookingAccountAuth;
    if (!auth) throw new ForbiddenException('Не определён аккаунт онлайн-записи');

    const [pdnAllowed, state] = await Promise.all([
      this.consentPolicy.hasActivePdnConsent(auth.tenantId, auth.accountId),
      this.consentPolicy.requiredConsentState(auth.tenantId, auth.accountId),
    ]);
    request.bookingConsentAccess = state;

    if (!pdnAllowed) {
      throw new ForbiddenException({
        code: 'PDN_CONSENT_REQUIRED',
        message: 'Необходимо подтвердить согласие на обработку персональных данных',
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
