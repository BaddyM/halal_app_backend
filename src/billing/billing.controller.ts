import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { BillingService } from './billing.service';
import { CheckoutDto, VerifyReceiptDto } from './dto';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Public catalogue — anyone can see the plans (e.g. on the paywall).
  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @Get('me/subscription')
  @UseGuards(AuthGuard)
  subscription(@Req() req: AuthedRequest) {
    return this.billing.getSubscription(req.user.userId);
  }

  @Get('me/transactions')
  @UseGuards(AuthGuard)
  transactions(@Req() req: AuthedRequest) {
    return this.billing.listTransactions(req.user.userId);
  }

  @Post('billing/checkout')
  @UseGuards(AuthGuard)
  checkout(@Req() req: AuthedRequest, @Body() dto: CheckoutDto) {
    return this.billing.checkout(req.user.userId, dto.planId, dto.provider);
  }

  @Post('billing/verify')
  @UseGuards(AuthGuard)
  verify(@Req() req: AuthedRequest, @Body() dto: VerifyReceiptDto) {
    return this.billing.verify(req.user.userId, dto.provider, dto.planId, dto.receipt);
  }

  @Post('billing/cancel')
  @UseGuards(AuthGuard)
  cancel(@Req() req: AuthedRequest) {
    return this.billing.cancel(req.user.userId);
  }
}
