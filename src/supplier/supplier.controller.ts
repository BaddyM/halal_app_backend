import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreatePurchaseOrderPaymentDto } from './dto/create-purchase-order-payment.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';

@Controller('supplier')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) { }

  @Post('product')
  createSupplierProduct(@Body() createSupplierProductDto: CreateSupplierProductDto) {
    return this.supplierService.createSupplierProduct(createSupplierProductDto);
  }

  @Get('product')
  findSupplierProducts(
    @Query('supplierId') supplierId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.supplierService.findSupplierProducts(supplierId, parseInt(page), parseInt(limit));
  }

  @Patch('product/:id')
  updateSupplierProduct(@Param('id') id: string, @Body() updateSupplierProductDto: UpdateSupplierProductDto) {
    return this.supplierService.updateSupplierProduct(id, updateSupplierProductDto);
  }

  @Delete('product/:id')
  removeSupplierProduct(@Param('id') id: string) {
    return this.supplierService.removeSupplierProduct(id);
  }

  @Post('purchase-order')
  createPurchaseOrder(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto) {
    return this.supplierService.createPurchaseOrder(createPurchaseOrderDto);
  }

  @Post('purchase-order/:id/payment')
  addPurchaseOrderPayment(@Param('id') id: string, @Body() paymentDto: CreatePurchaseOrderPaymentDto) {
    return this.supplierService.addPurchaseOrderPayment(id, paymentDto);
  }

  @Get('purchase-order')
  findPurchaseOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('supplierId') supplierId?: string,
  ) {
    return this.supplierService.findPurchaseOrders(parseInt(page), parseInt(limit), supplierId);
  }

  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.supplierService.create(createSupplierDto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.supplierService.findAll(parseInt(page), parseInt(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.supplierService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierService.remove(id);
  }
}
