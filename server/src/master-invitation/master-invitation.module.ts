import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalRuntimeModule } from '../legal-runtime/legal-runtime.module';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { MasterInvitationController } from './master-invitation.controller';
import { MasterInvitationService } from './master-invitation.service';

@Module({
  imports: [AuthModule, LegalRuntimeModule, TransactionalEmailModule],
  controllers: [MasterInvitationController],
  providers: [MasterInvitationService, PrismaService],
  exports: [MasterInvitationService],
})
export class MasterInvitationModule {}
