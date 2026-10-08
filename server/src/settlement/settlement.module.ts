import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { PrismaService } from '../prisma.service';
import { SettlementController } from './settlement.controller';
import { SettlementLifecycleService } from './settlement-lifecycle.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [SettlementController],
  providers: [SettlementService, SettlementLifecycleService, PrismaService],
  exports: [SettlementService],
})
export class SettlementModule {}
