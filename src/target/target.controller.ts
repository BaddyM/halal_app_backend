import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors, Inject } from '@nestjs/common';
import { TargetService } from './target.service';
import { CreateTargetDto, CreateTargetTransactionDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Cache, CACHE_MANAGER, CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiBearerAuth()
@Controller('target')
export class TargetController {
    constructor(private readonly targetService: TargetService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
    ) { }

    @UseGuards(AuthGuard)
    @Post()
    async create(@Body() createTargetDto: CreateTargetDto) {
        return this.targetService.create(createTargetDto);
    }

    @UseGuards(AuthGuard)
    @Post("transaction/create")
    async createTransaction(@Body() createTargetTransactionDto: CreateTargetTransactionDto) {
        return this.targetService.createTransaction(createTargetTransactionDto);
    }

    @UseGuards(AuthGuard)
    @Get()
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300_000)
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findAll(@Query("page") page: string, @Query("limit") limit: string) {
        return this.targetService.findAll(parseInt(page), parseInt(limit));
    }

    @UseGuards(AuthGuard)
    @Get(':userId')
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300_000)
    @ApiParam({ name: "userId" })
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findOne(@Param('userId') userId: string, @Query("page") page: string, @Query("limit") limit: string) {
        return this.targetService.findByUser(userId, parseInt(page), parseInt(limit));
    }

    @UseGuards(AuthGuard)
    @Get('transactions/:targetId')
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(300_000)
    @ApiParam({ name: "targetId" })
    @ApiQuery({ name: "page" })
    @ApiQuery({ name: "limit" })
    findTransactions(@Param('targetId') targetId: string, @Query("page") page: string, @Query("limit") limit: string) {
        return this.targetService.transactions(targetId, parseInt(page), parseInt(limit));
    }

    @UseGuards(AuthGuard)
    @Patch(':userId')
    update(@Param('userId') userId: string, @Body() updateTargetDto: UpdateTargetDto) {
        return this.targetService.update(userId, updateTargetDto);
    }
}
