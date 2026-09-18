import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { PlatformDocumentsController } from './platform-documents.controller';
import { PlatformDocumentsService } from './platform-documents.service';

@Module({
  imports: [AuthModule],
  controllers: [PlatformDocumentsController],
  providers: [PlatformDocumentsService, PlatformAdminGuard, PrismaService],
  exports: [PlatformDocumentsService],
})
export class PlatformDocumentsModule {}
