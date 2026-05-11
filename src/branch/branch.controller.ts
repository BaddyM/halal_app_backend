import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import {
  CreateStockTransferDto,
  UpsertBranchStockDto,
} from './dto/branch-stock.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchService.create(createBranchDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiQuery({ name: 'page' })
  @ApiQuery({ name: 'limit' })
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.branchService.findAll(parseInt(page), parseInt(limit));
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    return this.branchService.update(id, updateBranchDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchService.remove(id);
  }

  //Branch Stock
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('stock/upsert')
  upsertBranchStock(@Body() dto: UpsertBranchStockDto) {
    return this.branchService.upsert_branch_stock(dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('stock/list')
  @ApiQuery({ name: 'branchId', required: false })
  listBranchStock(@Query('branchId') branchId?: string) {
    return this.branchService.list_branch_stock(branchId);
  }

  //Stock Transfers
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('transfer')
  createStockTransfer(@Body() dto: CreateStockTransferDto) {
    return this.branchService.create_stock_transfer(dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Patch('transfer/:id/complete')
  completeStockTransfer(@Param('id') id: string) {
    return this.branchService.complete_stock_transfer(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('transfer/list')
  @ApiQuery({ name: 'branchId', required: false })
  listStockTransfers(@Query('branchId') branchId?: string) {
    return this.branchService.list_stock_transfers(branchId);
  }
}
