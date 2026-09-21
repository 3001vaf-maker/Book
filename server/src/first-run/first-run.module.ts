import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { TenantDocumentArchiveModule } from '../tenant-document-archive/tenant-document-archive.module';
import { FirstRunController } from './first-run.controller';
import { FirstRunService } from './first-run.service';

@Module({
  imports: [AuthModule, TenantDocumentArchiveModule],
  controllers: [FirstRunController],
  providers: [FirstRunService, PrismaService],
  exports: [FirstRunService],
})
export class FirstRunModule {}
