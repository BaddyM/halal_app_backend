import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  checkout(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      itemType: string;
      itemId: string;
      quantity?: number;
      discountCode?: string;
    },
  ) {
    if (!body.itemId) throw new BadRequestException('itemId is required');
    if (body.itemType === 'subscription') {
      return this.payments.createSubscriptionCheckout(
        req.user.userId,
        body.itemId,
        body.discountCode,
      );
    }
    if (body.itemType === 'gift') {
      return this.payments.createGiftCheckout(
        req.user.userId,
        body.itemId,
        body.quantity ?? 1,
      );
    }
    throw new BadRequestException('itemType must be subscription or gift');
  }

  @Get('status/:orderTrackingId')
  @UseGuards(AuthGuard)
  status(
    @Req() req: AuthedRequest,
    @Param('orderTrackingId') trackingId: string,
  ) {
    return this.payments.refreshOrder(req.user.userId, trackingId);
  }
}

@Controller('public/payments/pesapal')
export class PesapalIpnController {
  constructor(private readonly payments: PesapalService) {}

  @Get('ipn')
  ipnGet(
    @Query('OrderTrackingId') trackingId: string,
    @Query('OrderNotificationType') notificationType?: string,
  ) {
    return this.processIpn(trackingId, notificationType);
  }

  @Post('ipn')
  @HttpCode(HttpStatus.OK)
  ipnPost(
    @Body('OrderTrackingId') trackingId: string,
    @Body('OrderNotificationType') notificationType?: string,
  ) {
    return this.processIpn(trackingId, notificationType);
  }

  private processIpn(trackingId: string, notificationType?: string) {
    if (!trackingId)
      throw new BadRequestException('OrderTrackingId is required');
    return this.payments.processIpn(
      trackingId,
      notificationType ?? 'IPNCHANGE',
    );
  }
}
