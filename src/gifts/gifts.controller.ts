import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { GiftsService } from './gifts.service';

@Controller('gifts')
export class GiftsController {
  constructor(private readonly gifts: GiftsService) {}

  @Get('catalog')
  catalog() { return this.gifts.catalog(); }

  @Post('purchase')
  @UseGuards(AuthGuard)
  purchase(@Req() req: AuthedRequest, @Body() body: { giftId: string; quantity: number }) {
    return this.gifts.purchase(req.user.userId, body.giftId, Number(body.quantity));
  }

  @Get('inventory')
  @UseGuards(AuthGuard)
  inventory(@Req() req: AuthedRequest) { return this.gifts.inventory(req.user.userId); }

  @Post('send')
  @UseGuards(AuthGuard)
  send(@Req() req: AuthedRequest, @Body() body: { giftId: string; toUserId: string; quantity?: number; message?: string }) {
    return this.gifts.send(req.user.userId, body.giftId, body.toUserId, Number(body.quantity ?? 1), body.message);
  }

  @Get('received')
  @UseGuards(AuthGuard)
  received(@Req() req: AuthedRequest) { return this.gifts.received(req.user.userId); }
}

@Controller('admin/gifts')
@UseGuards(AuthGuard, AdminGuard)
export class AdminGiftsController {
  constructor(private readonly gifts: GiftsService) {}

  @Get() list() { return this.gifts.adminCatalog(); }
  @Post() create(@Body() body: any) { return this.gifts.createCatalogItem(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.gifts.updateCatalogItem(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.gifts.removeCatalogItem(id); }
}