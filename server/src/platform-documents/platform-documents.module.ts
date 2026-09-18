import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { PlatformOwnerGuard } from '../auth/platform-owner.guard';
import { PlatformDocumentsController } from './platform-documents.controller';
import { PlatformDocumentsService } from './platform-documents.service';

@Module({
  imports: [AuthModule],
  controllers: [PlatformDocumentsController],
  providers: [PlatformDocumentsService, PlatformOwnerGuard, PrismaService],
  exports: [PlatformDocumentsService],
})
export class PlatformDocumentsModule {}
