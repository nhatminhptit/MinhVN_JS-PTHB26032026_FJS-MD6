import { Server } from "socket.io";

const io = new Server(3000, {
  cors: { origin: "*" },
});

console.log("[Server] Đang chạy trên cổng 3000...");

io.on("connection", (socket) => {
  console.log("[Server] Client kết nối:", socket.id);

  socket.on("order:track", (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`[Server] Client ${socket.id} đã vào room: order_${orderId}`);
  });

  socket.on("admin:trigger_update", () => {
    console.log("[Server] Admin kích hoạt cập nhật đơn 1024!");
    io.to("order_1024").emit("order:updated", {
      orderId: "1024",
      status: "DANG_GIAO",
    });
  });

  socket.on("disconnect", () => {
    console.log(
      "[Server] Client ngắt kết nối:",
      socket.id,
    );
  });
});
