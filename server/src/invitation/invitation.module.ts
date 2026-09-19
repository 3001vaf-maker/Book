import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [AuthModule, TransactionalEmailModule],
  controllers: [InvitationController],
  providers: [InvitationService, PrismaService],
  exports: [InvitationService],
})
export class InvitationModule {}
