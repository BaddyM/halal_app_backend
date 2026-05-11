import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateSalaryAdvanceDto, CreateSalaryDto, CreateStaffDto, UpdateSalaryDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { ApiQuery } from '@nestjs/swagger';

@Controller('staff')
export class StaffController {
    constructor(private readonly staffService: StaffService) { }

    @Post()
    create(@Body() createStaffDto: CreateStaffDto) {
        return this.staffService.create(createStaffDto);
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.staffService.findAll(parseInt(page), parseInt(limit));
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
        return this.staffService.update(id, updateStaffDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.staffService.remove(id);
    }

    //Staff
    @Post("salary/create")
    create_salary(@Body() createSalaryDto: CreateSalaryDto) {
        return this.staffService.create_salary(createSalaryDto);
    }

    @Get("salary/list")
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    @ApiQuery({ name: "period", required: false })
    @ApiQuery({ name: "staffId", required: false })
    fetch_salary(@Query("page") page: string, @Query("limit") limit: string, @Query("period") period: string, @Query("staffId") staffId: string) {
        return this.staffService.fetch_salary(parseInt(page), parseInt(limit), period, staffId);
    }

    @Patch('salary/update/:id')
    update_salary(@Param('id') id: string, @Body() updateSalaryDto: UpdateSalaryDto) {
        return this.staffService.update_salary(id, updateSalaryDto);
    }

    @Delete('salary/delete/:id')
    remove_salary(@Param('id') id: string) {
        return this.staffService.delete_salary(id);
    }

    @Patch('salary/:id/paid')
    mark_salary_paid(@Param('id') id: string) {
        return this.staffService.mark_salary_paid(id);
    }

    @Get('salary/:id/payslip')
    generate_payslip(@Param('id') id: string) {
        return this.staffService.generate_payslip(id);
    }

    //Salary Advances
    @Post('advance/create')
    create_advance(@Body() dto: CreateSalaryAdvanceDto) {
        return this.staffService.create_salary_advance(dto);
    }

    @Get('advance/list')
    @ApiQuery({ name: 'staffId', required: false })
    list_advances(@Query('staffId') staffId?: string) {
        return this.staffService.list_salary_advances(staffId);
    }

    @Patch('advance/:id/repay')
    repay_advance(@Param('id') id: string) {
        return this.staffService.repay_salary_advance(id);
    }
}
