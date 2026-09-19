import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { PrismaService } from '../prisma.service';
import { ConsentPolicyService } from './consent-policy.service';
import { TenantDocumentArchiveController } from './tenant-document-archive.controller';
import { TenantDocumentArchiveService } from './tenant-document-archive.service';

@Module({
  imports: [AuthModule, BusinessStateModule],
  controllers: [TenantDocumentArchiveController],
  providers: [PrismaService, TenantDocumentArchiveService, ConsentPolicyService],
  exports: [TenantDocumentArchiveService, ConsentPolicyService],
})
export class TenantDocumentArchiveModule {}
