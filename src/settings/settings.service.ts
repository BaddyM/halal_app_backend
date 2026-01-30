import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateSettingDto, SendWelcomeMailDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SettingsService {
    constructor(private readonly mailerService: MailerService,
        private readonly prisma: PrismaService,
    ) { }

    async sendWelcomeMail(sendWelcomeMailDto: SendWelcomeMailDto) {
        try {
            await this.mailerService.sendMail({
                to: sendWelcomeMailDto.email,
                subject: 'Welcome to our App!',
                template: './welcome', // The name of the .hbs file (without extension)
                context: {            // Data to be passed to the template
                    name: sendWelcomeMailDto.username,
                    url: 'https://myapp.com/dashboard',
                    company: "Anchor Within",
                    year: new Date().getFullYear()
                },
                attachments: [
                    {
                        filename: 'logo.png',
                        // Point to the template directory specifically
                        path: join(__dirname, '..', 'templates', 'logo.png'),
                        cid: 'logo',
                    },
                ],
            });
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new InternalServerErrorException({
                success: false,
                message: "Failed to send email",
                error: e
            })
        }
    }

    async findOne(userId: string) {
        const data = await this.prisma.settings.findFirst({
            where: { userId },
        });
        return data;
    }

    async update(userId: string, updateSettingDto: UpdateSettingDto) {
        try {
            await this.prisma.settings.updateMany({
                where: { userId },
                data: { ...updateSettingDto }
            });
            return {
                success: true,
                message: "Update successfull",
            };
        } catch (e) {
            if (process.env.MODE == "Dev") {
                console.log("error", e);
            }
            throw new BadRequestException({
                success: true,
                message: "Failed to update"
            })
        }
    }
}
