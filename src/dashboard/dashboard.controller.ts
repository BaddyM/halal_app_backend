import { Controller, Get, Post, Body, Patch, Param, Delete, BadRequestException, Res, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(
        private readonly dashboardService: DashboardService,) { }

    @Get("summary")
    async summary(
        @Res() res: Response,
    ) {
        try {
            const data = await this.dashboardService.summary();
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: false,
                message: "Failed to fetch summary",
            });
        }
    }
}
