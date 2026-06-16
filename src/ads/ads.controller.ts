import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { AdsService } from './ads.service';
import { AdQueryDto } from './dto';

@UseGuards(AuthGuard)
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() q: AdQueryDto) {
    return this.ads.list(req.user.userId, q.placement);
  }

  @Post(':id/impression')
  impression(@Param('id') id: string) {
    return this.ads.recordImpression(id);
  }

  @Post(':id/click')
  click(@Param('id') id: string) {
    return this.ads.recordClick(id);
  }
}
