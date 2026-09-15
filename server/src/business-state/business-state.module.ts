import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { BusinessStateController } from './business-state.controller';
import { BusinessStateService } from './business-state.service';
import { ClientContactRulesService } from './client-contact-rules.service';

@Module({
  imports: [AuthModule],
  controllers: [BusinessStateController],
  providers: [BusinessStateService, ClientContactRulesService, PrismaService],
  exports: [BusinessStateService, ClientContactRulesService],
})
export class BusinessStateModule {}
