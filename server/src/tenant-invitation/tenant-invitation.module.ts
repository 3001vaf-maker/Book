import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { TenantInvitationController } from './tenant-invitation.controller';
import { TenantInvitationService } from './tenant-invitation.service';
import { FirstRunModule } from '../first-run/first-run.module';

@Module({
  imports: [AuthModule, TransactionalEmailModule, FirstRunModule],
  controllers: [TenantInvitationController],
  providers: [TenantInvitationService, PrismaService],
  exports: [TenantInvitationService],
})
export class TenantInvitationModule {}
