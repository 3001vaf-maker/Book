import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { ConsentPolicyService } from './consent-policy.service';
import { DocumentArchiveController } from './document-archive.controller';
import { DocumentArchiveService } from './document-archive.service';

@Module({
  imports: [AuthModule],
  controllers: [DocumentArchiveController],
  providers: [PrismaService, DocumentArchiveService, ConsentPolicyService],
  exports: [DocumentArchiveService, ConsentPolicyService],
})
export class DocumentArchiveModule {}
