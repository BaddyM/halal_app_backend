import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiBearerAuth()
@Controller('branch')
export class BranchController {
    constructor(private readonly branchService: BranchService) { }

    @Post()
    create(@Body() createBranchDto: CreateBranchDto) {
        return this.branchService.create(createBranchDto);
    }

    @Get()
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.branchService.findAll(parseInt(page), parseInt(limit));
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
        return this.branchService.update(id, updateBranchDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.branchService.remove(id);
    }
}
