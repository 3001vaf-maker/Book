import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessController } from './saas-access.controller';
import { SaasAccessService } from './saas-access.service';

@Module({
  imports: [AuthModule],
  controllers: [SaasAccessController],
  providers: [SaasAccessService, PrismaService],
  exports: [SaasAccessService],
})
export class SaasAccessModule {}
