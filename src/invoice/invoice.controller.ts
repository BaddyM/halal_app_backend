import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { InvoiceService } from './invoice.service';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  create(
    @Body()
    body: {
      userId: string;
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      items: {
        productId?: string;
        itemName: string;
        quantity: number;
        unitPrice: number;
        isCustom?: boolean;
      }[];
      memo?: string;
    },
  ) {
    return this.invoiceService.create(body);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'userId', required: false })
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.invoiceService.findAll(
      parseInt(page),
      parseInt(limit),
      status,
      userId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Post(':id/payment')
  addPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      userId: string;
    },
  ) {
    return this.invoiceService.addPayment(id, body);
  }

  @Post(':id/convert-to-sale')
  convertToSale(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.invoiceService.convertToSale(id, body.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.invoiceService.delete(id, body.userId);
  }
}
