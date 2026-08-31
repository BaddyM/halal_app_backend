import { Module } from '@nestjs/common';
import { HealthDisclosureService } from './health-disclosure.service';
import { HealthDisclosureController } from './health-disclosure.controller';

@Module({
  controllers: [HealthDisclosureController],
  providers: [HealthDisclosureService],
  exports: [HealthDisclosureService],
})
export class HealthDisclosureModule {}
