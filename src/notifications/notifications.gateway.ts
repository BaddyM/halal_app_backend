import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";


@WebSocketGateway({
    cors: { origin: '*' }
})
export class NotificationsGateway {
    @WebSocketServer() server: Server;

    sendNotification(message: string) {
        this.server.emit('notification', { message });
    }

    @SubscribeMessage('sendNotification')
    handleSendNotification(@MessageBody() data: { message: string }) {
        this.sendNotification(data.message);
    }
}
