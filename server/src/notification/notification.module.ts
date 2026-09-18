import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { DocumentStateModule } from '../document-state/document-state.module';
import { PrismaService } from '../prisma.service';
import { ProfileModule } from '../profile/profile.module';
import { SaasAccessModule } from '../saas-access/saas-access.module';
import { BookingLifecycleNotificationService } from './booking-lifecycle-notification.service';
import { NotificationController } from './notification.controller';
import { NotificationReminderService } from './notification-reminder.service';
import { NotificationService } from './notification.service';
import { NotificationTemplateService } from './notification-template.service';
import { WebPushService } from './web-push.service';

@Module({
  imports: [AuthModule, forwardRef(() => BusinessStateModule), DocumentStateModule, ProfileModule, SaasAccessModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationTemplateService,
    BookingLifecycleNotificationService,
    NotificationReminderService,
    WebPushService,
    PrismaService,
  ],
  exports: [NotificationService, NotificationTemplateService, BookingLifecycleNotificationService, NotificationReminderService, WebPushService],
})
export class NotificationModule {}
