import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [TransactionalEmailModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService, PrismaService],
})
export class PasswordResetModule {}
