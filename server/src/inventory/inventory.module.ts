import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';
import { InventoryController } from './inventory.controller';
import { InventoryExcelController } from './inventory-excel.controller';
import { InventoryExcelService } from './inventory-excel.service';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController, InventoryExcelController],
  providers: [InventoryService, InventoryExcelService, PrismaService],
  exports: [InventoryService],
})
export class InventoryModule {}
