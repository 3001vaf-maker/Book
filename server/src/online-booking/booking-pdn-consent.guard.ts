import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ConsentPolicyService } from '../document-state/consent-policy.service';

type AccountRequest = Request & {
  bookingAccountAuth?: { accountId: string; tenantId: string };
  bookingConsentAccess?: unknown;
};

@Injectable()
export class BookingPdnConsentGuard implements CanActivate {
  constructor(private readonly consentPolicy: ConsentPolicyService) {}

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

    return true;
  }
}
