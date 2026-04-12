import { Injectable } from '@nestjs/common';
import { CreateProductDto, StockTakeDto, StockTakeItemDto, UpdateStockTakeDto, UpdateStockTakeItemDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createProductDto: CreateProductDto) {
        const data = this.prisma.product.create({
            data: createProductDto,
        });
        return data;
    }

    async findAll(page: number, limit: number) {
        const data = await this.prisma.product.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        });
        const total = await this.prisma.product.count();
        const totalPages = Math.ceil(total / limit);
        return { totalPages, data };
    }

    async update(id: string, updateProductDto: UpdateProductDto) {
        const data = await this.prisma.product.update({
            where: { id },
            data: updateProductDto,
        });
        return data;
    }

    async delete(id: string) {
        const data = await this.prisma.product.delete({
            where: { id },
        });
        return data;
    }

    //Stock Take
    async create_stock_take(stockTake: StockTakeDto) {
        const data = await this.prisma.stockTake.create({
            data: stockTake,
        });
        return data;
    }

    async fetch_stock_take(page: number, limit: number) {
        const data = await this.prisma.stockTake.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" }
        });
        return data;
    }

    async update_stock_take(id: string, updateStockTake: UpdateStockTakeDto) {
        const data = await this.prisma.stockTake.update({
            where: { id },
            data: updateStockTake,
        });
        return data;
    }

    //Stock Take Item
    async create_stock_take_item(stockTake: StockTakeItemDto) {
        const data = await this.prisma.stockTakeItem.create({
            data: stockTake,
        });
        return data;
    }

    async fetch_stock_take_item(page: number, limit: number) {
        const data = await this.prisma.stockTakeItem.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" }
        });
        return data;
    }

    async update_stock_take_item(id: string, updateStockTakeItem: UpdateStockTakeItemDto) {
        const data = await this.prisma.stockTakeItem.update({
            where: { id },
            data: updateStockTakeItem,
        });
        return data;
    }
}
