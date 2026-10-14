const io = require("socket.io-client");

console.log("=== APP TÀI XẾ SHOPFAST KHỞI ĐỘNG ===");

const activeZones = ["QUAN_1", "QUAN_3"]; // Các quận tài xế đang chạy
const token = "token_tai_xe_123";

// CẤU HÌNH KẾT NỐI
const socket = io("http://localhost:3000", {
  auth: { token },
  // (1) Bật cơ chế tự động kết nối lại
  reconnection: true,
  // (2) Đặt giới hạn số lần thử và độ trễ giãn dần (Chống bão request)
  reconnectionAttempts: 10, // Chỉ thử tối đa 10 lần
  reconnectionDelay: 1000, // Lần đầu chờ 1 giây
  reconnectionDelayMax: 15000, // Giãn dần ra nhưng tối đa không quá 15 giây
});

// (3) Đăng ký lại Room sau khi nối lại
// LƯU Ý CỰC KỲ QUAN TRỌNG: Khi nối lại, Socket ID bị đổi. Server không biết tài xế này là ai.
// Phải chủ động emit lại sự kiện để vào lại Room, nếu không tài xế sẽ không bao giờ nổ đơn mới.
socket.on("connect", () => {
  console.log(`\n🟢 [App] Đã kết nối mạng thành công! (ID: ${socket.id})`);
  activeZones.forEach((zone) => {
    socket.emit("driver:register_zone", zone);
  });
});

// (4) Xử lý sự kiện mất mạng để cảnh báo màn hình
socket.on("disconnect", (reason) => {
  console.log(`\n🔴 [App - CẢNH BÁO] Bạn đã mất kết nối! (Lý do: ${reason})`);
  console.log("   -> Hệ thống đang tự động thử nối lại...");
});

// -- Các sự kiện log tiến trình thử lại (Tùy chọn cho sinh động) --
socket.io.on("reconnect_attempt", (attempt) => {
  console.log(`   ⏳ Đang thử nối lại... (Lần ${attempt})`);
});
socket.io.on("reconnect_failed", () => {
  console.log(`❌ [App] Đã thử 10 lần thất bại. Vui lòng kiểm tra lại 4G!`);
});

// ==========================================
// KỊCH BẢN KIỂM THỬ: ĐI VÀO HẦM MẤT MẠNG
// ==========================================
setTimeout(() => {
  console.log("\n⚠️ --- TÀI XẾ ĐI VÀO HẦM (NGẮT MẠNG CỨNG) --- ⚠️");
  socket.io.engine.close(); // Lệnh ép ngắt kết nối cưỡng bức
}, 2000);

// Giả lập 5 giây sau xe ra khỏi hầm, có sóng lại
setTimeout(() => {
  console.log("\n☀️ --- TÀI XẾ RA KHỎI HẦM (CÓ SÓNG LẠI) --- ☀️");
  socket.connect(); // Kích hoạt nối lại
}, 7000);
