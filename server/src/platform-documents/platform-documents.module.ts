import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { PlatformDocumentsController } from './platform-documents.controller';

@Module({
  imports: [AuthModule],
  controllers: [PlatformDocumentsController],
  providers: [PlatformAdminGuard, PrismaService],
})
export class PlatformDocumentsModule {}
