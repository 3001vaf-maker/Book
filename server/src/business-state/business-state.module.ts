import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalRuntimeModule } from '../legal-runtime/legal-runtime.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma.service';
import { BusinessStateController } from './business-state.controller';
import { BusinessStateService } from './business-state.service';
import { ClientContactRulesService } from './client-contact-rules.service';

@Module({
  imports: [AuthModule, LegalRuntimeModule, forwardRef(() => NotificationModule)],
  controllers: [BusinessStateController],
  providers: [BusinessStateService, ClientContactRulesService, PrismaService],
  exports: [BusinessStateService, ClientContactRulesService],
})
export class BusinessStateModule {}
