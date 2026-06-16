import { Global, Module } from '@nestjs/common';
import { RealtimeBus } from './realtime.bus';

// Global so any module can inject RealtimeBus to push socket events. The live
// Server is bound by ChatGateway.afterInit().
@Global()
@Module({
  providers: [RealtimeBus],
  exports: [RealtimeBus],
})
export class RealtimeModule {}
