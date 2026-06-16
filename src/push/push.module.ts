import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';

// Global so any module (users, chat, inbox…) can inject PushService to send
// notifications without re-importing.
@Global()
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
