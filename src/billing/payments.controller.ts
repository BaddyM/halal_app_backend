import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { PesapalService } from './pesapal.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PesapalService) {}

  @Get('config')
  config() {
    return this.payments.publicConfig();
  }

  @Post('checkout')
  @UseGuards(AuthGuard)
  checkout(@Req() req: AuthedRequest, @Body() body: { itemType: string; itemId: string; discountCode?: string }) {
    if (body.itemType !== 'subscription' || !body.itemId) {
      throw new BadRequestException('Only subscription checkout is currently available');
    }
    return this.payments.createSubscriptionCheckout(req.user.userId, body.itemId, body.discountCode);
  }

  @Get('status/:orderTrackingId')
  @UseGuards(AuthGuard)
  status(@Req() req: AuthedRequest, @Param('orderTrackingId') trackingId: string) {
    return this.payments.refreshOrder(req.user.userId, trackingId);
  }
}

@Controller('public/payments/pesapal')
export class PesapalIpnController {
  constructor(private readonly payments: PesapalService) {}

  @Post('ipn')
  ipn(@Query('OrderTrackingId') trackingId: string, @Body('OrderTrackingId') bodyTrackingId?: string) {
    const orderTrackingId = trackingId ?? bodyTrackingId;
    if (!orderTrackingId) return { received: false };
    return this.payments.refreshOrder(null, orderTrackingId).then((result) => ({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId,
      orderMerchantReference: '',
      status: result.status,
    }));
  }
}