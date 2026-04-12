import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('expense')
export class ExpenseController {
    constructor(private readonly expenseService: ExpenseService) { }

    @Post()
    create(@Body() createExpenseDto: CreateExpenseDto) {
        return this.expenseService.create(createExpenseDto);
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @ApiQuery({ name: "date", required: false })
    @ApiQuery({ name: "branchId", required: false })
    findAll(@Query("page") page: string, @Query("limit") limit: string, @Query("date") date: string, @Query("branchId") branchId: string) {
        return this.expenseService.findAll(parseInt(page), parseInt(limit), date, branchId);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
        return this.expenseService.update(id, updateExpenseDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.expenseService.remove(id);
    }
}
