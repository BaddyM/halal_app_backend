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
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto';

@UseGuards(AuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(@Req() req: AuthedRequest, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(req.user.userId, dto.token, dto.platform);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.devices.remove(req.user.userId, id);
  }
}
