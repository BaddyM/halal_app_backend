import { Controller, Post, Body, Res, Headers, BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Response } from 'express';
import { NotificationsDto } from './dto/notificationDto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private prisma: PrismaService,
    ) { }

    @Post("send")
    async send(
        @Body() body: NotificationsDto,
        @Res() res: Response,
        @Headers("authorization") authHeaders: any,
    ) {
        try {
            const token = authHeaders.split(" ")[1];
            const userId = await this.prisma.user.findFirst({
                where: {
                    accessToken: token,
                },
                select: {
                    id: true,
                    fcmToken: true,
                }
            });

            if (userId?.fcmToken) {
                await this.notificationsService.sendNotification(body.title, body.body, userId.fcmToken,)
                return res.status(200).json({
                    success:true,
                    message:"Notification sent successfully"
                });
            } else {
                return res.status(200).json({
                    success: true,
                    message: "Failed to send Notifications",
                });
            }
        } catch (err) {
            console.log(err);
            throw new BadRequestException({
                success: true,
                message: "Failed to send Notifications",
            });
        }
    }
}
