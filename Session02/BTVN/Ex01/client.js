const io = require("socket.io-client");

console.log("=== BẮT ĐẦU MÔ PHỎNG KIỂM THỬ ===");

// Khách 1: Theo dõi đơn 1024
const client1 = io("http://localhost:3000");
client1.on("connect", () => {
  client1.emit("order:track", "1024");
});
client1.on("order:updated", (data) => {
  console.log("🔔 [Màn hình Khách 1 - Đơn 1024] Nhận được thông báo:", data);
});

// Khách 2: Theo dõi đơn 2048
const client2 = io("http://localhost:3000");
client2.on("connect", () => {
  client2.emit("order:track", "2048");
});
client2.on("order:updated", (data) => {
  console.log("🔔 [Màn hình Khách 2 - Đơn 2048] Nhận được thông báo:", data);
});

// Sau 2 giây, kích hoạt cập nhật đơn 1024
setTimeout(() => {
  console.log("\n--- KÍCH HOẠT CẬP NHẬT ĐƠN 1024 ---");
  client1.emit("admin:trigger_update");
}, 2000);

// Sau 4 giây, Khách 1 tắt trình duyệt
setTimeout(() => {
  console.log("\n--- KHÁCH 1 RỜI ĐI ---");
  client1.disconnect();
}, 4000);
