import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma.service';
import { BusinessStateController } from './business-state.controller';
import { BusinessStateModule } from './business-state.module';

@Module({
  imports: [AuthModule, BusinessStateModule, NotificationModule],
  controllers: [BusinessStateController],
  providers: [PrismaService],
})
export class BusinessStateHttpModule {}
