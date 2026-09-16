import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BookingPublicationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = String(request.params?.tenantId || '').trim();
    if (!tenantId) throw new NotFoundException('Онлайн-запись не найдена');

    const publication = await this.prisma.bookingPublication.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (!publication) throw new NotFoundException('Онлайн-запись ещё не опубликована');
    return true;
  }
}
