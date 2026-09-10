import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
