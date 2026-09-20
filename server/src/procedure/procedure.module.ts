import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProcedureService } from './procedure.service';

@Module({
  providers: [ProcedureService, PrismaService],
  exports: [ProcedureService],
})
export class ProcedureModule {}
