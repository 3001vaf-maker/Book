import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AccountDocumentService } from './account-document.service';
import { DocumentRegistryService } from './document-registry.service';
import { RegistrationDocumentService } from './registration-document.service';

@Module({
  providers: [PrismaService, DocumentRegistryService, AccountDocumentService, RegistrationDocumentService],
  exports: [DocumentRegistryService, AccountDocumentService, RegistrationDocumentService],
})
export class DocumentRegistryModule {}
