import { BadRequestException, Injectable } from '@nestjs/common';
import { TogglePernmission } from './dto/create-setting.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }
    async togglePermission(togglePermission: TogglePernmission) {
        //Email exists
        const emailExists = await this.prisma.user.count({
            where: { email: togglePermission.email },
        });
        if (emailExists > 0) {
            const checkPermission = await this.prisma.permission.count({
                where: { email: togglePermission.email }
            });
            if (checkPermission > 0) {
                //Exists
                const data = await this.prisma.permission.update({
                    where: { id: togglePermission.id },
                    data: { isActive: togglePermission.isActive }
                });
                return data;
            } else {
                //Create
                const data = await this.prisma.permission.create({
                    data: {
                        email: togglePermission.email,
                        page: togglePermission.page,
                        isActive: togglePermission.isActive,
                    },
                });
                return data;
            }
        } else {
            throw new BadRequestException({
                success: false,
                error: `Email doesn't exist.`
            })
        }
    }

    async checkPermission(email: string) {
        const data = await this.prisma.permission.findFirst({
            where: { email }
        });
        return data;
    }

    async findAll() {
        const data = await this.prisma.permission.findMany();
        return data;
    }
}
