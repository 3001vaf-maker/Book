import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { LegalRuntimeService } from '../legal-runtime/legal-runtime.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BookingPublicationGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legal: LegalRuntimeService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = String(request.params?.tenantId || '').trim();
    if (!tenantId) throw new NotFoundException('Онлайн-запись не найдена');

    let publication = await this.prisma.bookingPublication.findUnique({
      where: { tenantId },
      select: { id: true },
    });

    if (!publication) {
      const access = await this.prisma.tenantAccess.findUnique({
        where: { tenantId },
        select: { isOwnerBook: true },
      });
      if (access?.isOwnerBook) {
        publication = await this.prisma.bookingPublication.create({
          data: {
            tenantId,
            revision: 1,
            data: { source: 'owner-runtime-self-heal' },
          },
          select: { id: true },
        });
      }
    }

    if (!publication) throw new NotFoundException('Онлайн-запись ещё не опубликована');

    await this.legal.assertPublicBooking(tenantId);
    return true;
  }
}
