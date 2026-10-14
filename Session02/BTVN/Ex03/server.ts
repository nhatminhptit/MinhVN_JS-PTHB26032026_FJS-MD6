import { Server } from "socket.io";

const io = new Server(3000, { cors: { origin: "*" } });

console.log("[Server] Khung chat hỗ trợ khởi động tại cổng 3000...");

io.on("connection", (socket) => {
  socket.on("chat:join", ({ sessionId, role }) => {
    const roomName = `session_${sessionId}`;
    socket.join(roomName);

    socket.data.sessionId = sessionId;
    socket.data.role = role;

    console.log(`[Server] ${role} đã tham gia ${roomName}`);
  });

  socket.on("chat:message", (text: string) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    if (!text || text.trim().length === 0) {
      return socket.emit("chat:error", "Không thể gửi tin nhắn rỗng.");
    }

    if (text.length > 20000) {
      return socket.emit(
        "chat:error",
        "Tin nhắn quá dài (vượt ngưỡng 20.000 ký tự). Vui lòng chia nhỏ.",
      );
    }

    const roomName = `session_${sessionId}`;
    const messagePayload = {
      id: Math.random().toString(36).substring(7),
      text: text.trim(),
      sender: socket.data.role,
      timestamp: Date.now(),
    };

    io.to(roomName).emit("chat:new_message", messagePayload);
  });

  socket.on("chat:typing", (isTyping: boolean) => {
    const roomName = `session_${socket.data.sessionId}`;
    socket
      .to(roomName)
      .emit("chat:typing_status", { role: socket.data.role, isTyping });
  });

  socket.on("chat:read", () => {
    const roomName = `session_${socket.data.sessionId}`;
    socket.to(roomName).emit("chat:read_receipt", { time: Date.now() });
  });

  socket.on("disconnect", () => {
    if (socket.data.role === "agent") {
      io.to(`session_${socket.data.sessionId}`).emit(
        "chat:agent_left",
        "Nhân viên hỗ trợ đã rời phiên. Yêu cầu của bạn đã được đưa về hàng chờ.",
      );
    }
  });
});
