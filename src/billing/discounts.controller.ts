import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { DiscountsService } from './discounts.service';

@Controller('discounts')
@UseGuards(AuthGuard)
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Post('validate')
  validate(@Body() body: { code: string; itemId?: string }) {
    return this.discounts.validate(body.code, body.itemId);
  }
}

@Controller('admin/discounts')
@UseGuards(AuthGuard, AdminGuard)
export class AdminDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  list() {
    return this.discounts.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.discounts.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.discounts.update(id, body);
  }
}