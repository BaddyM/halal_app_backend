import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

interface AdminSocket extends Socket {
  data: { userId?: string };
}

/// Realtime channel for the admin dashboard. Authenticates the JWT *and*
/// requires `role === 'admin'`; admins join the `feed` room and receive
/// `admin:event` pushes (plus an `admin:backlog` snapshot on connect).
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/admin' })
export class AdminGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(AdminGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
  ) {}

  afterInit() {
    this.bus.bindAdmin(this.server);
    this.logger.log('Admin realtime gateway ready at /admin');
  }

  async handleConnection(client: AdminSocket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer /, '');
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get('SYSTEM_SECRET') ?? 'dev-secret',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true },
      });
      if (user?.role !== 'admin') {
        client.disconnect(true);
        return;
      }
      client.data.userId = payload.sub;
      await client.join('feed');
      // Send the current backlog so the feed isn't empty on first load.
      client.emit('admin:backlog', this.bus.recentAdminEvents());
      this.logger.log(`admin socket ${client.id} connected (${payload.sub})`);
    } catch {
      client.disconnect(true);
    }
  }
}
