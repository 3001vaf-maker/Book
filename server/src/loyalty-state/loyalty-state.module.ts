import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { LoyaltyStateController } from './loyalty-state.controller';
import { LoyaltyStateService } from './loyalty-state.service';

@Module({
  imports: [AuthModule],
  controllers: [LoyaltyStateController],
  providers: [PrismaService, LoyaltyStateService],
  exports: [LoyaltyStateService],
})
export class LoyaltyStateModule {}
