import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { PushService } from 'src/push/push.service';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto';

@UseGuards(AuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly push: PushService,
  ) {}

  @Post()
  register(@Req() req: AuthedRequest, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(req.user.userId, dto.token, dto.platform);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.devices.remove(req.user.userId, id);
  }

  /// Sends a push to the caller's own devices. Handy for verifying the whole
  /// FCM chain (credentials → token → device) from the app itself.
  @Post('test')
  async test(@Req() req: AuthedRequest) {
    await this.push.sendToUser(req.user.userId, {
      title: 'Test notification 🔔',
      body: 'Push notifications are working.',
      data: { type: 'test' },
    });
    return { sent: true };
  }
}
