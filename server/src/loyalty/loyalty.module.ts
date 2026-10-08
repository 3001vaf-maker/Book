import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { PrismaService } from '../prisma.service';
import { DepositService } from './deposit.service';
import { LoyaltyController } from './loyalty.controller';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [LoyaltyController],
  providers: [DepositService, PrismaService],
  exports: [DepositService],
})
export class LoyaltyModule {}
