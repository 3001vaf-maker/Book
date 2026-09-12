import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DocumentStateController } from './document-state.controller';
import { DocumentStateService } from './document-state.service';

@Module({
  controllers: [DocumentStateController],
  providers: [PrismaService, DocumentStateService],
  exports: [DocumentStateService],
})
export class DocumentStateModule {}
