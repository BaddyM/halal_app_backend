import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
    imports: [AuthModule],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
})
export class ChatModule {}
