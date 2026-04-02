import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, CreditSalePaymentDto, UpdateCreditSaleDto, UpdateCreditSalePaymentDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('sales')
export class SalesController {
    constructor(private readonly salesService: SalesService) { }

    @Post()
    create(@Body() createSaleDto: CreateSaleDto[]) {
        return this.salesService.create(createSaleDto);
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @ApiQuery({ name: "date", required: false })
    findAll(@Query("page") page: string, @Query("limit") limit: string, @Query("date") date: string) {
        return this.salesService.findAll(parseInt(page), parseInt(limit), date);
    }

    @Get(":orderId")
    @ApiParam({ name: "orderId" })
    findOne(@Param("orderId") orderId: string) {
        return this.salesService.findOne(orderId);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto) {
        return this.salesService.update(id, updateSaleDto);
    }

    //Credit Sales
    @Get("creditsales/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    fetch_credit_sales(@Query("page") page: string, @Query("limit") limit: string) {
        return this.salesService.fetch_credit_sale(parseInt(page), parseInt(limit));
    }

    @Patch("creditsales/update/:id")
    @ApiParam({ name: "id" })
    update_credit_sale(@Param("id") id: string, @Body() updateCreditSale: UpdateCreditSaleDto) {
        return this.salesService.update_credit_sale(id, updateCreditSale);
    }

    //Credit Payment
    @Post("credit/payment")
    create_credit_payment(@Body() creditPaymentDto: CreditSalePaymentDto) {
        return this.salesService.create_credit_payment(creditPaymentDto);
    }

    @Get("credit/payment/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    fetch_credit_payment(@Query("page") page: string, @Query("limit") limit: string) {
        return this.salesService.fetch_credit_payment(parseInt(page), parseInt(limit));
    }

    @Patch("credit/payment/update/:id")
    @ApiParam({ name: "id" })
    update_credit_payment(@Param("id") id: string, @Body() updateCreditPayment: UpdateCreditSalePaymentDto) {
        return this.salesService.update_credit_payment(id, updateCreditPayment);
    }
}