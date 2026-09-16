import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LegalRuntimeModule } from '../legal-runtime/legal-runtime.module';
import { PrismaService } from '../prisma.service';
import { AuxiliaryStateController } from './auxiliary-state.controller';
import { AuxiliaryStateService } from './auxiliary-state.service';

@Module({
  imports: [AuthModule, LegalRuntimeModule],
  controllers: [AuxiliaryStateController],
  providers: [PrismaService, AuxiliaryStateService],
  exports: [AuxiliaryStateService],
})
export class AuxiliaryStateModule {}
