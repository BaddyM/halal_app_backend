import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto, SendWelcomeMailDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post()
  sendMail(@Body() sendWelcomeMailDto: SendWelcomeMailDto) {
    return this.settingsService.sendWelcomeMail(sendWelcomeMailDto);
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.settingsService.findOne(userId);
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.update(userId, updateSettingDto);
  }
}
