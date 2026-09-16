import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { DocumentStateModule } from '../document-state/document-state.module';
import { PrismaService } from '../prisma.service';
import { BookingLifecycleNotificationService } from './booking-lifecycle-notification.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationTemplateService } from './notification-template.service';
import { WebPushService } from './web-push.service';

@Module({
  imports: [AuthModule, forwardRef(() => BusinessStateModule), DocumentStateModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationTemplateService, BookingLifecycleNotificationService, WebPushService, PrismaService],
  exports: [NotificationService, NotificationTemplateService, BookingLifecycleNotificationService, WebPushService],
})
export class NotificationModule {}
