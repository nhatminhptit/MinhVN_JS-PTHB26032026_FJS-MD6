const io = require("socket.io-client");

console.log("=== BẮT ĐẦU KỊCH BẢN MÔ PHỎNG 3 NHÓM NGƯỜI DÙNG ===\n");

// 1. Kết nối với 3 token khác nhau để giả lập 3 App
const customerApp = io("http://localhost:3000", {
  auth: { token: "token_khachhang" },
});
const driverApp = io("http://localhost:3000", {
  auth: { token: "token_taixe" },
});
const dispatchApp = io("http://localhost:3000", {
  auth: { token: "token_dieuphoi" },
});

// --- LẮNG NGHE SỰ KIỆN ---
customerApp.on("order:location_updated", (data) =>
  console.log(
    `📱 [App Khách hàng] Xe đang tới: Tọa độ (${data.lat}, ${data.lng})`,
  ),
);
// Khách hàng tuyệt đối không nghe được sự cố nội bộ

driverApp.on("driver:assigned", (data) => {
  console.log(
    `\n🛵 [App Tài xế] TING TING! Nhận cuốc mới: Đơn ${data.orderId}`,
  );

  // Tài xế bắt đầu di chuyển và phát tọa độ
  setTimeout(
    () =>
      driverApp.emit("driver:update_location", {
        orderId: data.orderId,
        lat: 10.8,
        lng: 106.6,
      }),
    1000,
  );
  setTimeout(
    () =>
      driverApp.emit("driver:update_location", {
        orderId: data.orderId,
        lat: 10.9,
        lng: 106.7,
      }),
    2000,
  );

  // Tài xế gặp sự cố
  setTimeout(
    () =>
      driverApp.emit("driver:report_stuck", {
        orderId: data.orderId,
        reason: "Xe thủng lốp giữa đường",
      }),
    3500,
  );
});

dispatchApp.on("order:location_updated", (data) =>
  console.log(
    `💻 [Màn hình Điều phối] Giám sát GPS: Đơn ${data.orderId} ở (${data.lat}, ${data.lng})`,
  ),
);
dispatchApp.on("alert:order_stuck", (data) =>
  console.log(
    `\n🚨 [Màn hình Điều phối - BÁO ĐỘNG] Tài xế ${data.driverId} báo cáo sự cố: ${data.reason}!!!`,
  ),
);

// --- THỰC THI LUỒNG NGHIỆP VỤ ---
setTimeout(() => {
  console.log("\n--- Bước 1: Điều phối viên chủ động chỉ định đơn ---");
  dispatchApp.emit("dispatcher:assign", {
    driverId: "D_01",
    orderId: "ORD_99",
  });
}, 1500);

setTimeout(() => {
  console.log("\n--- Bước 2: Tài xế sập nguồn điện thoại đột ngột ---");
  driverApp.disconnect(); // Gây mất kết nối
}, 5000);
