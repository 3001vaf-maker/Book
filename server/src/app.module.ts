import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [AuthModule, WorkspaceModule, ProfileModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
