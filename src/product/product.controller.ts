import { Controller, Get, Post, Body, Patch, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto, CreateStockTakeDto, StockTakeItemDto, UpdateStockTakeItemDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('product')
export class ProductController {
    constructor(private readonly productService: ProductService) { }

    @Post()
    create(@Body() createProductDto: CreateProductDto) {
        return this.productService.create(createProductDto);
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @ApiQuery({ name: "category", required: false })
    findAll(@Query("page") page: string, @Query("limit") limit: string, @Query("category") category: string) {
        return this.productService.findAll(parseInt(page), parseInt(limit), category);
    }

    @Get('low-stock/list')
    lowStockList() {
        return this.productService.low_stock_list();
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
        return this.productService.update(id, updateProductDto);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.productService.delete(id);
    }

    //Stock Take Item
    @Post("stockTake/item/create")
    create_stock_take_item(@Body() createStockTakeItemDto: CreateStockTakeDto) {
        return this.productService.create_stock_take_item(createStockTakeItemDto);
    }

    @Get("stockTake/item/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @ApiQuery({ name: "userId", required: false })
    fetch_stock_take_item(@Query("page") page: string, @Query("limit") limit: string, @Query("userId") userId: string) {
        return this.productService.fetch_stock_take_item(parseInt(page), parseInt(limit), userId);
    }

    @Get("stockTake/item/history/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    fetch_stock_take_item_history(@Query("page") page: string, @Query("limit") limit: string) {
        return this.productService.fetch_stock_take_item_history(parseInt(page), parseInt(limit));
    }

    @Patch('stockTake/item/:id')
    update_stock_take_item(@Param('id') id: string, @Body() updateStockTakeItemDto: UpdateStockTakeItemDto) {
        return this.productService.update_stock_take_item(id, updateStockTakeItemDto);
    }

}
