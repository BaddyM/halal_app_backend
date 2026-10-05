import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { PesapalService } from './pesapal.service';

@Controller('admin/payments')
@UseGuards(AuthGuard, AdminGuard)
export class PaymentsAdminController {
  constructor(private readonly payments: PesapalService) {}

  @Get('config')
  config() {
    return this.payments.adminSettings();
  }

  @Patch('config')
  updateConfig(@Body() body: Record<string, string>) {
    return this.payments.saveSettings(body);
  }

  @Post('test-connection')
  testConnection() {
    return this.payments.testConnection();
  }

  @Post('test')
  test() {
    return this.payments.testConnection();
  }

  @Get('transactions')
  transactions(@Query('status') status?: string, @Query('search') search?: string) {
    return this.payments.adminTransactions(status, search);
  }
}