import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountGuard } from '../online-booking/account.guard';
import { PrismaService } from '../prisma.service';
import { AccountUnreadController } from './account-unread.controller';
import { AccountUnreadService } from './account-unread.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountUnreadController],
  providers: [AccountUnreadService, AccountGuard, PrismaService],
})
export class AccountUnreadModule {}
