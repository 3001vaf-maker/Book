import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PlatformDocumentsService } from './platform-documents.service';

@Module({
  providers: [PrismaService, PlatformDocumentsService],
  exports: [PlatformDocumentsService],
})
export class PlatformDocumentsModule {}
