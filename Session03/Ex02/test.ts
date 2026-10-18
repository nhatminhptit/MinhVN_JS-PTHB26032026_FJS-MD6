import { SlidingWindowLimiter } from "./limiter";

const limiter = new SlidingWindowLimiter();

console.log("==================================================");
console.log("       BẮT ĐẦU CHẠY BỘ KIỂM THỬ RATE LIMITER      ");
console.log("==================================================");

// ---------------------------------------------------------------
// TEST 1: CHỨNG MINH KỊCH BẢN TẤN CÔNG BIÊN BỊ CHẶN ĐỨNG
// ---------------------------------------------------------------
console.log(
  "\n--- TEST 1: Tấn công biên (100 req ở giây 59, 100 req ở giây 61) ---",
);
const attacker = "user_attacker";

// Giây thứ 59 (59.000 ms): Gửi 100 request
let allowedAt59 = 0;
for (let i = 0; i < 100; i++) {
  if (limiter.isAllowed(attacker, 59_000)) allowedAt59++;
}
console.log(`Tại giây 59: Cho qua ${allowedAt59}/100 request.`);

// Giây thứ 61 (61.000 ms): Kẻ tấn công gửi tiếp 100 request
let allowedAt61 = 0;
let blockedAt61 = 0;
for (let i = 0; i < 100; i++) {
  if (limiter.isAllowed(attacker, 61_000)) {
    allowedAt61++;
  } else {
    blockedAt61++;
  }
}
console.log(
  `Tại giây 61: Cho qua ${allowedAt61}/100 request | Bị CHẶN: ${blockedAt61}/100 request.`,
);

if (blockedAt61 > 0) {
  console.log("-> KẾT QUẢ: Tấn công biên đã bị CHẶN ĐỨNG thành công!");
} else {
  console.log("-> KẾT QUẢ THẤT BẠI: Lỗ hổng biên vẫn tồn tại!");
}

// ---------------------------------------------------------------
// TEST 2: LƯU LƯỢNG ĐỀU ĐẶN 90 REQUEST/PHÚT KHÔNG BỊ CHẶN OAN
// ---------------------------------------------------------------
console.log("\n--- TEST 2: Lưu lượng đều đặn 90 request/phút ---");
const normalUser = "user_normal";
let normalAllowed = 0;

// Gửi 90 request trải đều trong 60 giây (mỗi request cách nhau 666ms)
for (let i = 0; i < 90; i++) {
  const timestamp = Math.floor(i * (60_000 / 90));
  if (limiter.isAllowed(normalUser, timestamp)) {
    normalAllowed++;
  }
}
console.log(`Gửi 90 request đều đặn: Cho qua ${normalAllowed}/90 request.`);
console.log(
  normalAllowed === 90
    ? "-> KẾT QUẢ: Hoạt động chính xác, không chặn oan!"
    : "-> KẾT QUẢ: Bị chặn nhầm!",
);

// ---------------------------------------------------------------
// TEST 3: BẪY DỮ LIỆU - KHÓA MỚI TINH CHƯA TỪNG XUẤT HIỆN
// ---------------------------------------------------------------
console.log("\n--- TEST 3: Khóa mới tinh ---");
try {
  const isOk = limiter.isAllowed("user_brand_new", 10_000);
  console.log(
    `Khóa mới gọi lần đầu: ${isOk ? "Cho qua thành công" : "Bị từ chối"} (Không ném lỗi Exception)`,
  );
} catch (err) {
  console.log("-> LỖI: Bị crash chương trình!");
}

// ---------------------------------------------------------------
// TEST 4: BẪY DỮ LIỆU - KHÓA TỪNG DÙNG CÁCH ĐÂY 10 PHÚT
// ---------------------------------------------------------------
console.log("\n--- TEST 4: Khóa quay lại sau 10 phút ---");
const returningUser = "user_returning";

// 10 phút trước (tại timestamp = 0): Dùng hết sạch hạn mức 100 request
for (let i = 0; i < 100; i++) {
  limiter.isAllowed(returningUser, 0);
}

// 10 phút sau (tại timestamp = 600.000 ms): Quay lại gọi tiếp
const allowedAfter10Min = limiter.isAllowed(returningUser, 600_000);
console.log(
  `10 phút sau quay lại gọi request: ${allowedAfter10Min ? "Được cho qua (Dữ liệu cũ đã xóa sạch)" : "Bị chặn sai lầm"}`,
);
