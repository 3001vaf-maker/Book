import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [InventoryService, PrismaService],
  exports: [InventoryService],
})
export class InventoryModule {}
