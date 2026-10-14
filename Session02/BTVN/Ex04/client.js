const EventSource = require("eventsource");

console.log("=== BẢNG ĐIỀU KHIỂN VẬN HÀNH KHO KHỞI ĐỘNG ===");

const Es = EventSource.EventSource || EventSource;
const dashboardStream = new Es("http://localhost:3000/dashboard-stream");

dashboardStream.onopen = () => {
  console.log("🟢 [Dashboard] Đã kết nối thành công tới Server.");
};

dashboardStream.addEventListener("warning", (event) => {
  const data = JSON.parse(event.data);
  console.log(`\n🚨 [CẢNH BÁO KHẨN CẤP]: ${data.msg} (Lúc: ${data.time})`);
});

dashboardStream.onerror = (error) => {
  console.log(
    "🔴 [Dashboard] Mạng nội bộ chập chờn. Đang tự động kết nối lại...",
  );
};
