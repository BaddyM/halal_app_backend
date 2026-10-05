import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/admin/admin.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get() summary(@Req() req: AuthedRequest) { return this.wallet.summary(req.user.userId); }
  @Get('transactions') transactions(@Req() req: AuthedRequest) { return this.wallet.transactions(req.user.userId); }
  @Get('withdrawals') withdrawals(@Req() req: AuthedRequest) { return this.wallet.withdrawals(req.user.userId); }
  @Post('withdraw') withdraw(@Req() req: AuthedRequest, @Body() body: { amount: number; method: string; details: Record<string, unknown> }) {
    return this.wallet.requestWithdrawal(req.user.userId, Number(body.amount), body.method, body.details ?? {});
  }
}

@Controller('admin/withdrawals')
@UseGuards(AuthGuard, AdminGuard)
export class AdminWithdrawalsController {
  constructor(private readonly wallet: WalletService) {}

  @Get() list(@Query('status') status?: string, @Query('search') search?: string) {
    return this.wallet.adminList(status, search);
  }
  @Get('users/:userId/transactions') userLedger(@Param('userId') userId: string) {
    return this.wallet.adminUserLedger(userId);
  }
  @Post(':id/approve') approve(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.wallet.review(id, req.user.userId, 'approve');
  }
  @Post(':id/mark-paid') paid(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { reference: string }) {
    return this.wallet.review(id, req.user.userId, 'paid', body);
  }
  @Post(':id/reject') reject(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.wallet.review(id, req.user.userId, 'reject', body);
  }
}

@Controller('admin/wallet/settings')
@UseGuards(AuthGuard, AdminGuard)
export class AdminWalletSettingsController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getSettings() {
    return this.wallet.withdrawalSettings();
  }

  @Patch()
  updateSettings(@Body() body: { minWithdrawal: number }) {
    return this.wallet.updateWithdrawalSettings(Number(body.minWithdrawal));
  }
}