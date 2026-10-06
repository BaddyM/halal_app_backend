import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MailModule } from 'src/mail/mail.module';
import { ChatController, ChatsContractController } from './chat.controller';
import { ChatService } from './chat.service';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';
import { WaliModule } from 'src/wali/wali.module';

@Module({
    imports: [AuthModule, MailModule, WaliModule],
    controllers: [ChatController, ChatsContractController],
    providers: [ChatService, AiService, ChatGateway],
})
export class ChatModule {}
