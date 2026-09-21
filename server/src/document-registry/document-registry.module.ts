import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AccountDocumentService } from './account-document.service';
import { DocumentRegistryService } from './document-registry.service';

@Module({
  providers: [PrismaService, DocumentRegistryService, AccountDocumentService],
  exports: [DocumentRegistryService, AccountDocumentService],
})
export class DocumentRegistryModule {}
