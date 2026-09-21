import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { FirstRunController } from './first-run.controller';
import { FirstRunService } from './first-run.service';

@Module({
  imports: [AuthModule],
  controllers: [FirstRunController],
  providers: [FirstRunService, PrismaService],
  exports: [FirstRunService],
})
export class FirstRunModule {}
