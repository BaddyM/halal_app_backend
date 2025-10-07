import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { TogglePernmission } from './dto/create-setting.dto';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Post("togglePermission")
    togglePermission(@Body() togglePermission: TogglePernmission) {
        return this.settingsService.togglePermission(togglePermission);
    }

    @Get("permission/fetch")
    findAll() {
        return this.settingsService.findAll();
    }

    @Get('permission/check/:email')
    findOne(@Param('email') email: string) {
        return this.settingsService.checkPermission(email);
    }
}
