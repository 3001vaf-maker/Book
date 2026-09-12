import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { BusinessStateController } from './business-state.controller';
import { BusinessStateService } from './business-state.service';

@Module({
  imports: [AuthModule],
  controllers: [BusinessStateController],
  providers: [BusinessStateService, PrismaService],
  exports: [BusinessStateService],
})
export class BusinessStateModule {}
