import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class OrderGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  @SubscribeMessage("order:track")
  handleTrack(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!orderId) return { ok: false };

    client.join(`order_${orderId}`);
    return { ok: true };
  }

  notifyStatusChanged(orderId: string, status: string) {
    this.server
      .to(`order_${orderId}`)
      .emit("order:updated", { orderId, status });
  }

  @SubscribeMessage("admin:trigger_update")
  triggerFakeUpdate() {
    console.log("[Server] Giả lập: Admin cập nhật đơn 1024 thành DANG_GIAO");
    this.notifyStatusChanged("1024", "DANG_GIAO");
  }

  handleDisconnect(client: Socket) {
    console.log("[Server] Client rời đi:", client.id);
  }
}
