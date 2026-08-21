import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';

@Module({
    imports: [AuthModule, MailModule],
    controllers: [ChatController],
    providers: [ChatService, AiService, ChatGateway],
})
export class ChatModule {}
