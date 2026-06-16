import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';

export type AdminEventType =
  | 'signup'
  | 'match'
  | 'message'
  | 'report'
  | 'subscription'
  | 'moderation';

export interface AdminEvent {
  id: string;
  type: AdminEventType;
  text: string;
  at: string;
  meta?: Record<string, unknown>;
}

/// App-wide socket emitter. The ChatGateway binds the live `Server` here on
/// init; any service can then push realtime events to a specific user
/// (`user:{id}` room), a conversation (`conv:{id}` room) or everyone.
///
/// Events used across the app:
///   user room  → match:new, message:new (bump), notification:new,
///                subscription:updated, account:banned
///   conv room  → message:new, message:flagged, message:read, typing, presence
///   broadcast  → admin:broadcast
///   admin feed → admin:event (live moderation/activity stream, /admin namespace)
@Injectable()
export class RealtimeBus {
  private server?: Server;
  private adminServer?: Server;
  // Ring buffer of the most recent admin events, newest first, so a dashboard
  // that connects (or polls) can render an immediate backlog.
  private adminFeed: AdminEvent[] = [];
  private static readonly ADMIN_FEED_MAX = 50;

  bind(server: Server) {
    this.server = server;
  }

  /// Bound by AdminGateway.afterInit() — the socket.io namespace server for
  /// `/admin`, whose connected clients are authenticated admins in room `feed`.
  bindAdmin(server: Server) {
    this.adminServer = server;
  }

  emitToConversation(conversationId: string, event: string, payload: unknown) {
    this.server?.to(`conv:${conversationId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /// Broadcast to every connected client (e.g. admin announcements).
  broadcast(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  /// Publish a platform event to the live admin feed. Best-effort: stores it in
  /// the backlog buffer and pushes it to connected admins. Never throws.
  emitAdminEvent(type: AdminEventType, text: string, meta?: Record<string, unknown>) {
    try {
      const evt: AdminEvent = {
        id: randomUUID(),
        type,
        text,
        at: new Date().toISOString(),
        ...(meta ? { meta } : {}),
      };
      this.adminFeed.unshift(evt);
      if (this.adminFeed.length > RealtimeBus.ADMIN_FEED_MAX) {
        this.adminFeed.length = RealtimeBus.ADMIN_FEED_MAX;
      }
      this.adminServer?.to('feed').emit('admin:event', evt);
    } catch {
      // swallow — the feed is non-critical
    }
  }

  /// Most recent admin events, newest first (for initial backlog).
  recentAdminEvents(): AdminEvent[] {
    return this.adminFeed;
  }
}
