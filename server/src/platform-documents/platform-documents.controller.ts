import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformOwnerGuard } from '../auth/platform-owner.guard';
import { PlatformDocumentsService } from './platform-documents.service';

@Controller('platform-documents')
@UseGuards(JwtAuthGuard, PlatformOwnerGuard)
export class PlatformDocumentsController {
  constructor(private readonly documents: PlatformDocumentsService) {}

  @Get()
  list() {
    return this.documents.list();
  }

  @Get('history')
  history() {
    return this.documents.history();
  }

  @Post()
  publish(@Body() body: Record<string, unknown>) {
    return this.documents.publish(body || {});
  }
}
