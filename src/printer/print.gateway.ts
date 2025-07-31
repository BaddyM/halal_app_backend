import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";


@WebSocketGateway()
export class PrintGateway {
  @WebSocketServer() server: Server;

  sendPrintJob(job: any) {
    this.server.emit('print_job', job);
  }
}
