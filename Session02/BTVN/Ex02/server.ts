import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: { origin: "*" },
  pingInterval: 5000,
  pingTimeout: 3000,
});

console.log("[Server] Đang chạy tại cổng 3000...");

io.on("connection", (socket) => {
  console.log(`[Server] Tài xế online (Socket ID: ${socket.id})`);

  socket.on("driver:register_zone", (zoneId) => {
    socket.join(`zone_${zoneId}`);
    console.log(
      `[Server] Tài xế ${socket.id} đã đăng ký nhận đơn ở: zone_${zoneId}`,
    );
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Server] Tài xế ${socket.id} đã OFFLINE. Lý do: ${reason}`);
  });
});

httpServer.listen(3000);
