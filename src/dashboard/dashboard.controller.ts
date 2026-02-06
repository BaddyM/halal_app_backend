import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Response } from 'express';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(
        private readonly dashboardService: DashboardService,) { }

    @Get("summary")
    async summary() {
        try {
            const data = await this.dashboardService.summary();
            return data;
        } catch (err) {
            if (process.env.MODE == "Dev") {
                console.log(err);
            }
            throw new BadRequestException({
                success: false,
                message: "Failed to fetch summary",
            });
        }
    }

    @Get("mobile/:userId")
    @ApiParam({ name: "userId" })
    async mobile_summary(@Param("userId") userId: string) {
        try {
            return await this.dashboardService.mobile_summary(userId);
        } catch (err) {
            if (process.env.MODE == "Dev") {
                console.log(err);
            }
            throw new BadRequestException({
                success: false,
                message: "Failed to fetch summary",
            });
        }
    }
}
