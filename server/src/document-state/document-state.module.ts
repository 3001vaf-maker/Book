import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { ConsentPolicyService } from './consent-policy.service';
import { DocumentStateController } from './document-state.controller';
import { DocumentStateService } from './document-state.service';

@Module({
  imports: [AuthModule],
  controllers: [DocumentStateController],
  providers: [PrismaService, DocumentStateService, ConsentPolicyService],
  exports: [DocumentStateService, ConsentPolicyService],
})
export class DocumentStateModule {}
