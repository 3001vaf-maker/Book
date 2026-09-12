import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { BusinessStateService } from '../business-state/business-state.service';
import { DocumentStateService } from '../document-state/document-state.service';
import { PrismaService } from '../prisma.service';

type AccountRequest = Request & {
  bookingAccountAuth?: { accountId: string; tenantId: string };
  bookingConsentAccess?: unknown;
};

@Injectable()
export class BookingRequiredConsentGuard implements CanActivate {
  constructor(
    private readonly businessState: BusinessStateService,
    private readonly documents: DocumentStateService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    const auth = request.bookingAccountAuth;
    if (!auth) throw new ForbiddenException('Не определён аккаунт онлайн-записи');

    const identity = await this.businessState.bookingIdentityForAccount(auth.tenantId, auth.accountId);
    const clientId = String(identity?.person?.key || '').trim();
    if (!clientId) throw new ForbiddenException('Не определена клиентская карта');

    const state = await this.documents.requiredConsentState(auth.tenantId, clientId);
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
