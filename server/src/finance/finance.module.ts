import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FinanceService } from './finance.service';

@Module({
  providers: [FinanceService, PrismaService],
  exports: [FinanceService],
})
export class FinanceModule {}
