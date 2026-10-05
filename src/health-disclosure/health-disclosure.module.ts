import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { HealthDisclosureService } from './health-disclosure.service';
import { HealthDisclosureController } from './health-disclosure.controller';

@Module({
  imports: [AuthModule],
  controllers: [HealthDisclosureController],
  providers: [HealthDisclosureService],
  exports: [HealthDisclosureService],
})
export class HealthDisclosureModule {}
