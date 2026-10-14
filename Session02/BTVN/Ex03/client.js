const io = require("socket.io-client");

// Kịch bản: 1 Khách hàng mở 2 tab điện thoại/máy tính, 1 Nhân viên hỗ trợ
const tab1 = io("http://localhost:3000");
const tab2 = io("http://localhost:3000");
const agent = io("http://localhost:3000");

const SESSION_ID = "1024";

// ==========================================
// THIẾT LẬP KẾT NỐI
// ==========================================
tab1.on("connect", () =>
  tab1.emit("chat:join", { sessionId: SESSION_ID, role: "customer" }),
);
tab2.on("connect", () =>
  tab2.emit("chat:join", { sessionId: SESSION_ID, role: "customer" }),
);
agent.on("connect", () =>
  agent.emit("chat:join", { sessionId: SESSION_ID, role: "agent" }),
);

// ==========================================
// LẮNG NGHE SỰ KIỆN TRÊN MÀN HÌNH
// ==========================================
// Cài đặt chung cho cả Tab 1 và Tab 2 để chứng minh đồng bộ
[tab1, tab2].forEach((tab, index) => {
  tab.on("chat:new_message", (msg) => {
    console.log(
      `\n📱 [Tab ${index + 1} của Khách] Nhận tin nhắn: "${msg.text}" (Độ trễ: ${Date.now() - msg.timestamp}ms)`,
    );
  });
  tab.on("chat:error", (errMsg) => {
    console.log(`\n🚫 [Tab ${index + 1} của Khách] Báo lỗi: ${errMsg}`);
  });
  tab.on("chat:agent_left", (msg) => {
    console.log(`\n⚠️ [Tab ${index + 1} của Khách] Hệ thống: ${msg}`);
  });
});

agent.on("chat:new_message", (msg) => {
  console.log(`\n💻 [Màn hình Nhân viên] Nhận tin nhắn: "${msg.text}"`);
  // Tự động báo đã xem khi nhận được tin
  agent.emit("chat:read");
});

agent.on("chat:typing_status", ({ isTyping }) => {
  if (isTyping)
    console.log(
      `   💬 [Màn hình Nhân viên] Hiển thị: "Khách hàng đang soạn tin..."`,
    );
  else console.log(`   [Màn hình Nhân viên] Đã ẩn biểu tượng gõ phím.`);
});

tab1.on("chat:read_receipt", () =>
  console.log(`   👀 [Tab 1] Chữ "Đã xem" hiện lên.`),
);

// ==========================================
// THỰC THI KỊCH BẢN TEST BẪY DỮ LIỆU
// ==========================================
setTimeout(() => {
  console.log("\n--- TEST 1: Bẫy gửi khoảng trắng ---");
  tab1.emit("chat:message", "    "); // Sẽ bị Backend từ chối
}, 1000);

setTimeout(() => {
  console.log("\n--- TEST 2: Bẫy gửi 20.000 ký tự ---");
  const longText = "A".repeat(20005);
  tab1.emit("chat:message", longText); // Sẽ bị Backend từ chối
}, 2000);

setTimeout(() => {
  console.log("\n--- TEST 3: Giả lập đang gõ phím (Typing) ---");
  tab1.emit("chat:typing", true);

  // Đúng 3 giây sau, frontend tự động tắt trạng thái gõ phím
  setTimeout(() => {
    tab1.emit("chat:typing", false);
  }, 3000);
}, 3000);

setTimeout(() => {
  console.log("\n--- TEST 4: Gửi tin nhắn hợp lệ & Đồng bộ 2 tab ---");
  tab1.emit("chat:message", "Cho tôi hỏi đơn hàng mã ORD_99 bao giờ giao?");
  // Tin nhắn này sẽ nổ ra ở cả Tab 1, Tab 2 và màn hình Nhân viên với độ trễ < 1s
}, 7000);

setTimeout(() => {
  console.log("\n--- TEST 5: Nhân viên ngắt kết nối ---");
  agent.disconnect();
}, 8000);
