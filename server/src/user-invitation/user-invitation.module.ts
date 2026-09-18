import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { UserInvitationController } from './user-invitation.controller';
import { UserInvitationService } from './user-invitation.service';

@Module({
  imports: [AuthModule, TransactionalEmailModule],
  controllers: [UserInvitationController],
  providers: [UserInvitationService, PrismaService],
  exports: [UserInvitationService],
})
export class UserInvitationModule {}
