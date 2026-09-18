import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocumentRegistryService } from './document-registry.service';

@Module({
  providers: [PrismaService, DocumentRegistryService],
  exports: [DocumentRegistryService],
})
export class DocumentRegistryModule {}
