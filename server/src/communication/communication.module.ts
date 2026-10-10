import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessStateModule } from '../business-state/business-state.module';
import { TenantDocumentArchiveModule } from '../tenant-document-archive/tenant-document-archive.module';
import { NotificationModule } from '../notification/notification.module';
import { PlatformNoticeModule } from '../platform-notice/platform-notice.module';
import { TransactionalEmailModule } from '../transactional-email/transactional-email.module';
import { PrismaService } from '../prisma.service';
import { CommunicationBroadcastService } from './communication-broadcast.service';
import { CommunicationController } from './communication.controller';
import { CommunicationDispatchService } from './communication-dispatch.service';
import { CommunicationHistoryService } from './communication-history.service';
import { CommunicationService } from './communication.service';
import { TelegramBotService } from './telegram-bot.service';
import { EmailChannelService } from './email-channel.service';
import { ProfessionalEmailService } from './professional-email.service';
import { SaasAccessModule } from '../saas-access/saas-access.module';

@Module({
  imports: [AuthModule, BusinessStateModule, TenantDocumentArchiveModule, NotificationModule, PlatformNoticeModule, TransactionalEmailModule, SaasAccessModule],
  controllers: [CommunicationController],
  providers: [CommunicationService, CommunicationHistoryService, CommunicationDispatchService, CommunicationBroadcastService, TelegramBotService, EmailChannelService, ProfessionalEmailService, PrismaService],
  exports: [CommunicationService, CommunicationHistoryService, CommunicationDispatchService, CommunicationBroadcastService, TelegramBotService, EmailChannelService, ProfessionalEmailService],
})
export class CommunicationModule {}
