import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BranchPayablesService } from './branch-payables.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('admin/branch-payables')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BranchPayablesController {
  constructor(private readonly svc: BranchPayablesService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.svc.list(parseInt(page), parseInt(limit), branchId, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post(':id/deposits')
  createDeposit(@Param('id') id: string, @Body() dto: CreateDepositDto) {
    return this.svc.createDeposit(id, dto);
  }
}
