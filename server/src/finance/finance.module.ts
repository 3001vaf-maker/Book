import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PersonalAccountFinanceService } from './personal-account-finance.service';

@Module({
  imports: [AuthModule, SaasAccessModule],
  controllers: [FinanceController],
  providers: [FinanceService, PersonalAccountFinanceService, PrismaService],
  exports: [FinanceService, PersonalAccountFinanceService],
})
export class FinanceModule {}
