import {
  Body,
  Delete,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { ChatService } from './chat.service';
import {
  MessagesQueryDto,
  SendMessageDto,
  StartConversationDto,
  SendToUserDto,
} from './dto';

@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@Req() req: AuthedRequest) {
    return this.chat.listConversations(req.user.userId);
  }
  @Post('conversations')
  start(@Req() req: AuthedRequest, @Body() dto: StartConversationDto) {
    return this.chat.findOrCreate(req.user.userId, dto.otherUserId);
  }

  @Post('send')
  sendToUser(@Req() req: AuthedRequest, @Body() dto: SendToUserDto) {
    return this.chat.sendToUser(req.user.userId, dto.otherUserId, dto.text, {
      type: dto.type,
      mediaUrl: dto.mediaUrl,
    });
  }

  @Get('conversations/:id/messages')
  messages(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() q: MessagesQueryDto,
  ) {
    return this.chat.getMessages(req.user.userId, id, q);
  }

  @Post('conversations/:id/messages')
  send(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(req.user.userId, id, dto.text, {
      type: dto.type,
      mediaUrl: dto.mediaUrl,
    });
  }

  @Delete('conversations/:conversationId/messages/:messageId')
  deleteMessage(
    @Req() req: AuthedRequest,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chat.deleteMessage(req.user.userId, conversationId, messageId);
  }

  @Post('conversations/:id/read')
  markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.chat.markRead(req.user.userId, id);
  }

  @Post('conversations/:id/involve-wali')
  involveWali(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { summary?: string },
  ) {
    return this.chat.involveWali(req.user.userId, id, body?.summary);
  }

  @Post('conversations/:id/typing')
  typing(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { typing: boolean },
  ) {
    return this.chat.broadcastTyping(req.user.userId, id, !!body?.typing);
  }
}

@UseGuards(AuthGuard)
@Controller('chats')
export class ChatsContractController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.chat.listConversations(req.user.userId);
  }

  @Get(':id/messages')
  messages(@Req() req: AuthedRequest, @Param('id') id: string, @Query() query: MessagesQueryDto) {
    return this.chat.getMessages(req.user.userId, id, query);
  }

  @Post(':id/messages')
  send(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { text: string }) {
    return this.chat.sendMessage(req.user.userId, id, body.text);
  }

  @Post(':id/read')
  markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.chat.markRead(req.user.userId, id);
  }
}
