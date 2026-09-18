import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformDocumentsModule } from '../platform-documents/platform-documents.module';
import { ConsentPolicyService } from './consent-policy.service';
import { DocumentStateController } from './document-state.controller';
import { DocumentStateService } from './document-state.service';

@Module({
  imports: [AuthModule, PlatformDocumentsModule],
  controllers: [DocumentStateController],
  providers: [PrismaService, DocumentStateService, ConsentPolicyService],
  exports: [DocumentStateService, ConsentPolicyService],
})
export class DocumentStateModule {}
