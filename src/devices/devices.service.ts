import { Injectable } from '@nestjs/common';
import { DevicePlatform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /// How many push tokens this account has registered. Used by /devices/test to
  /// distinguish "push failed" from "nothing to send to".
  async countForUser(userId: string): Promise<number> {
    return this.prisma.device.count({ where: { userId } });
  }

  /// Registers (or re-points) a push token. Tokens are globally unique, so if
  /// the same token was registered to another account we move it to this user.
  async register(userId: string, token: string, platform: DevicePlatform) {
    const device = await this.prisma.device.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
    return { id: device.id };
  }

  async remove(userId: string, id: string) {
    await this.prisma.device.deleteMany({ where: { id, userId } });
    return { success: true };
  }
}
