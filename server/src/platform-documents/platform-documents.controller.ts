import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../saas-admin/platform-admin.guard';
import { PLATFORM_LEGAL_PACKAGE } from './platform-document-catalog';

const BOOK_USER_KEYS = [
  'privacy-policy',
  'saas-agreement',
  'master-pd-consent',
  'marketing-consent',
  'public-profile-consent',
  'dpa',
] as const;

const USER_DOCUMENT_BASE_KEYS = [
  'user-document-pdn-policy',
  'user-document-pdn-consent',
  'user-document-messages-consent',
] as const;

function publicDocument(key: string) {
  const item = PLATFORM_LEGAL_PACKAGE.find((document) => document.key === key);
  if (!item) return null;
  return {
    key: item.key,
    type: item.type,
    title: item.title,
    content: item.content,
  };
}

@Controller('platform-documents')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformDocumentsController {
  @Get()
  list() {
    return {
      bookUserDocuments: BOOK_USER_KEYS.map(publicDocument).filter(Boolean),
      userDocumentBases: USER_DOCUMENT_BASE_KEYS.map(publicDocument).filter(Boolean),
    };
  }
}
