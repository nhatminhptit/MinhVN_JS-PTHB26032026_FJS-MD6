import { Server, Socket } from "socket.io";
import * as http from "http";

class DispatchService {
  private activeDrivers = new Map<
    string,
    { status: string; currentOrder?: string }
  >();

  registerDriver(driverId: string) {
    this.activeDrivers.set(driverId, { status: "FREE" });
    console.log(`[Service] Tài xế ${driverId} sẵn sàng nhận đơn.`);
  }

  removeDriver(driverId: string) {
    this.activeDrivers.delete(driverId);
    console.log(`[Service] Đã dọn dẹp bộ nhớ của tài xế ${driverId}.`);
  }

  assignOrder(driverId: string, orderId: string): boolean {
    const driver = this.activeDrivers.get(driverId);
    if (driver && driver.status === "FREE") {
      driver.status = "BUSY";
      driver.currentOrder = orderId;
      return true;
    }
    return false;
  }
}

const dispatchService = new DispatchService();
const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token === "token_khachhang") {
    socket.data = { role: "customer", id: "C_01", orderId: "ORD_99" };
    return next();
  }
  if (token === "token_taixe") {
    socket.data = { role: "driver", id: "D_01" };
    return next();
  }
  if (token === "token_dieuphoi") {
    socket.data = { role: "dispatcher", id: "ADMIN" };
    return next();
  }
  return next(new Error("Authentication error: Sai Token"));
});

io.on("connection", (socket) => {
  const { role, id, orderId } = socket.data;
  console.log(`[Auth] ${role} (${id}) kết nối thành công.`);

  if (role === "customer") socket.join(`order_${orderId}`);
  if (role === "driver") {
    socket.join(`driver_${id}`);
    dispatchService.registerDriver(id);
  }
  if (role === "dispatcher") socket.join("dispatchers");

  socket.on("driver:update_location", (payload) => {
    if (role !== "driver") return;
    io.to(`order_${payload.orderId}`)
      .to("dispatchers")
      .emit("order:location_updated", payload);
  });

  socket.on("driver:report_stuck", (payload) => {
    if (role !== "driver") return;
    io.to("dispatchers").emit("alert:order_stuck", {
      driverId: id,
      ...payload,
    });
  });

  socket.on("dispatcher:assign", (payload) => {
    if (role !== "dispatcher") return;
    const success = dispatchService.assignOrder(
      payload.driverId,
      payload.orderId,
    );
    if (success) {
      io.to(`driver_${payload.driverId}`).emit("driver:assigned", {
        orderId: payload.orderId,
      });
      console.log(
        `[Gateway] Đã ép đơn ${payload.orderId} cho tài xế ${payload.driverId}`,
      );
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Gateway] ${role} (${id}) mất kết nối.`);
    if (role === "driver") {
      dispatchService.removeDriver(id);
      io.to("dispatchers").emit("alert:order_stuck", {
        driverId: id,
        reason: "Tài xế mất tín hiệu GPS hoàn toàn!",
      });
    }
  });
});

httpServer.listen(3000, () => {
  console.log("[Server] Trung tâm điều phối chạy tại cổng 3000");
});
