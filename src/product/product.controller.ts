import { Controller, Get, Post, Body, Patch, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto, StockTakeDto, StockTakeItemDto, UpdateStockTakeDto, UpdateStockTakeItemDto } from './dto/create-product.dto';
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
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.productService.findAll(parseInt(page), parseInt(limit));
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
        return this.productService.update(id, updateProductDto);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.productService.delete(id);
    }

    //Stock Take
    @Post("stockTake/create")
    create_stock_take(@Body() createStockTakeDto: StockTakeDto) {
        return this.productService.create_stock_take(createStockTakeDto);
    }

    @Get("stockTake/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    fetch_stock_take(@Query("page") page: string, @Query("limit") limit: string) {
        return this.productService.fetch_stock_take(parseInt(page), parseInt(limit));
    }

    @Patch('stockTake/:id')
    update_stock_take(@Param('id') id: string, @Body() updateStockTakeDto: UpdateStockTakeDto) {
        return this.productService.update_stock_take(id, updateStockTakeDto);
    }

    //Stock Take Item
    @Post("stockTake/item/create")
    create_stock_take_item(@Body() createStockTakeItemDto: StockTakeItemDto) {
        return this.productService.create_stock_take_item(createStockTakeItemDto);
    }

    @Get("stockTake/item/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    fetch_stock_take_item(@Query("page") page: string, @Query("limit") limit: string) {
        return this.productService.fetch_stock_take_item(parseInt(page), parseInt(limit));
    }

    @Patch('stockTake/item/:id')
    update_stock_take_item(@Param('id') id: string, @Body() updateStockTakeItemDto: UpdateStockTakeItemDto) {
        return this.productService.update_stock_take_item(id, updateStockTakeItemDto);
    }

}
