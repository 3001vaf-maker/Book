import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InventoryService } from './inventory.service';

type AuthenticatedRequest = Request & {
  auth?: { platformAccountId: string; tenantId: string; role: string };
};

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  snapshot(@Req() request: AuthenticatedRequest) {
    return this.inventory.snapshot(request.auth!.tenantId);
  }

  @Post('items')
  createItem(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.inventory.createItem(request.auth!.tenantId, body);
  }

  @Put('items/:itemId')
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ) {
    return this.inventory.updateItem(request.auth!.tenantId, itemId, body);
  }

  @Post('movements')
  createMovement(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.inventory.createMovement(request.auth!.tenantId, body);
  }

  @Post('movements/:movementId/correct')
  correctMovement(
    @Req() request: AuthenticatedRequest,
    @Param('movementId') movementId: string,
    @Body() body: unknown,
  ) {
    return this.inventory.correctMovement(request.auth!.tenantId, movementId, body);
  }
}
