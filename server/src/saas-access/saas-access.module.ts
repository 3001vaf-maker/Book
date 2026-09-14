import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SaasAccessService } from './saas-access.service';

@Module({
  providers: [SaasAccessService, PrismaService],
  exports: [SaasAccessService],
})
export class SaasAccessModule {}
