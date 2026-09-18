import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma.service';
import { BusinessStateController } from './business-state.controller';
import { BusinessStateService } from './business-state.service';
import { PersonContactRulesService } from './person-contact-rules.service';

@Module({
  imports: [AuthModule, forwardRef(() => NotificationModule)],
  controllers: [BusinessStateController],
  providers: [BusinessStateService, PersonContactRulesService, PrismaService],
  exports: [BusinessStateService, PersonContactRulesService],
})
export class BusinessStateModule {}
