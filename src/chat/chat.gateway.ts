import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';
import { getJwtSecret } from 'src/auth/jwt-secret';

interface AuthedSocket extends Socket {
    data: { userId?: string };
}

const CHAT_DEFAULT_CORS_ORIGINS = [
    'https://halalconnect.space',
    'https://www.halalconnect.space',
    'https://admin.halalconnect.space',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

function isAllowedSocketOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    const configured = (
        process.env.CORS_ORIGINS ??
        process.env.DASHBOARD_ORIGINS ??
        process.env.FRONTEND_URL ??
        ''
    )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    const allowed = Array.from(new Set([...CHAT_DEFAULT_CORS_ORIGINS, ...configured]));
    if (allowed.includes(origin)) return true;

    try {
        const host = new URL(origin).hostname.toLowerCase();
        return ['localhost', '127.0.0.1'].includes(host) || allowed.some((candidate) => {
            try {
                const candidateHost = new URL(candidate).hostname.toLowerCase();
                return host === candidateHost || host.endsWith(`.${candidateHost}`);
            } catch {
                return false;
            }
        });
    } catch {
        return false;
    }
}

@WebSocketGateway({
    cors: {
        origin: (origin, callback) => {
            if (isAllowedSocketOrigin(origin)) return callback(null, true);
            return callback(new Error('Origin is not allowed by CORS'));
        },
    },
    namespace: '/chat',
})
export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly bus: RealtimeBus,
    ) {}

    afterInit() {
        this.bus.bind(this.server);
        this.logger.log('Realtime gateway ready at /chat');
    }

    async handleConnection(client: AuthedSocket) {
        const token =
            (client.handshake.auth?.token as string | undefined) ??
            (client.handshake.headers.authorization?.replace(/^Bearer /, '') as
                | string
                | undefined);
        if (!token) {
            client.disconnect(true);
            return;
        }
        try {
            const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
                secret: getJwtSecret(this.config),
            });
            client.data.userId = payload.sub;
            void client.join(`user:${payload.sub}`);
            this.logger.log(`socket ${client.id} connected as user ${payload.sub}`);
            void this.broadcastPresence(payload.sub, true);
        } catch {
            client.disconnect(true);
        }
    }

    handleDisconnect(client: AuthedSocket) {
        const userId = client.data.userId;
        if (userId) void this.broadcastPresence(userId, false);
        this.logger.log(`socket ${client.id} disconnected`);
    }

    /// Tell the people this user is in conversations with that they came
    /// online / went offline, so the chat header can show live presence.
    private async broadcastPresence(userId: string, online: boolean) {
        const convs = await this.prisma.conversation.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            select: { id: true },
        });
        for (const c of convs) {
            this.bus.emitToConversation(c.id, 'presence', { userId, online });
        }
    }

    @SubscribeMessage('conversation:join')
    async onJoin(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() body: { conversationId: string },
    ) {
        const userId = client.data.userId;
        if (!userId || !body?.conversationId) return;
        const conv = await this.prisma.conversation.findUnique({
            where: { id: body.conversationId },
        });
        if (!conv) return;
        if (conv.userAId !== userId && conv.userBId !== userId) return;
        await client.join(`conv:${body.conversationId}`);
    }

    @SubscribeMessage('conversation:leave')
    async onLeave(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() body: { conversationId: string },
    ) {
        if (!body?.conversationId) return;
        await client.leave(`conv:${body.conversationId}`);
    }

    @SubscribeMessage('typing')
    async onTyping(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() body: { conversationId: string; typing: boolean },
    ) {
        const userId = client.data.userId;
        if (!userId || !body?.conversationId) return;
        // Echo to the room (other peer will pick it up via conv:* room)
        client.to(`conv:${body.conversationId}`).emit('typing', {
            conversationId: body.conversationId,
            userId,
            typing: !!body.typing,
        });
    }
}
