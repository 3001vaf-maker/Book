import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ConsentPolicyService } from '../tenant-document-archive/consent-policy.service';

type AccountRequest = Request & {
  bookingAccountAuth?: { accountId: string; tenantId: string };
};

@Injectable()
export class BookingPdnConsentGuard implements CanActivate {
  constructor(private readonly consentPolicy: ConsentPolicyService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    const auth = request.bookingAccountAuth;
    if (!auth) throw new ForbiddenException('Не определён аккаунт онлайн-записи');

    const state = await this.consentPolicy.accountConsentState(auth.tenantId, auth.accountId);
    if (!state.pdnActive) {
      throw new ForbiddenException({
        code: 'PDN_CONSENT_REQUIRED',
        message: 'Необходимо подтвердить согласие на обработку персональных данных',
        ...state,
      });
    }

    return true;
  }
}
