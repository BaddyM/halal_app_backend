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
  updateConfig(
    @Body()
    body: {
      consumerKey?: string;
      consumerSecret?: string;
      environment?: 'sandbox' | 'live';
      callbackUrl?: string;
      ipnId?: string;
      enabled?: boolean;
      currency?: string;
      provider?: 'pesapal';
    },
  ) {
    return this.payments.saveSettings(body);
  }

  @Post('test-connection')
  testConnection(
    @Body() body: {
      consumerKey?: string;
      consumerSecret?: string;
      environment?: 'sandbox' | 'live';
    },
  ) {
    return this.payments.testConnection(body);
  }

  @Post('test')
  test(
    @Body() body: {
      consumerKey?: string;
      consumerSecret?: string;
      environment?: 'sandbox' | 'live';
    },
  ) {
    return this.payments.testConnection(body);
  }

  @Get('transactions')
  transactions(@Query('status') status?: string, @Query('search') search?: string) {
    return this.payments.adminTransactions(status, search);
  }
}