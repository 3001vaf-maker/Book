import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { LegalRuntimeService } from './legal-runtime.service';
import { PlatformLegalController } from './platform-legal.controller';
import { TenantLegalController } from './tenant-legal.controller';

@Module({
  imports: [AuthModule, SaasAccessModule],
  controllers: [PlatformLegalController, TenantLegalController],
  providers: [LegalRuntimeService, PrismaService],
  exports: [LegalRuntimeService],
})
export class LegalRuntimeModule {}
