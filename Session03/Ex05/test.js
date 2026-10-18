const BASE_URL = "http://localhost:3000";

async function postOrder(payload) {
  const res = await fetch(`${BASE_URL}/orders/flash-sale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runDemo() {
  console.log(
    "==================================================================",
  );
  console.log(
    "   BẮT ĐẦU DIỄN TẬP PHÒNG THỦ NGÀY HỘI MUA SẮM FLASH SALE 11/11   ",
  );
  console.log(
    "==================================================================\n",
  );

  // --- KỊCH BẢN 1: BOT LOẠI 1 (SPAM TẦN SUẤT CAO - BỊ LỚP 1 CHẶN 429) ---
  console.log(
    "--- 1. Kiểm thử Bot Spam Request liên thanh (Ngưỡng: 3 req/s) ---",
  );
  for (let i = 1; i <= 5; i++) {
    const res = await postOrder({
      userId: `bot_spammer_${i}`,
      dwellTimeMs: 2000,
    });
    console.log(`Request ${i}: Status = ${res.status} | ${res.data.message}`);
  }

  // Chờ 1.2s để reset cửa sổ IP
  await new Promise((r) => setTimeout(r, 1200));

  // --- KỊCH BẢN 2: BOT LOẠI 2 (AUTO-CLICKER QUÁ NHANH - BỊ LỚP 2 CHẶN 403) ---
  console.log(
    "\n--- 2. Kiểm thử Bot Auto-Clicker gửi đơn sau 80ms (Ngưỡng: >= 1000ms) ---",
  );
  const bot2Res = await postOrder({
    userId: "bot_fast_script",
    dwellTimeMs: 80,
  });
  console.log(
    `Status = ${bot2Res.status} (Bị chặn bởi Lớp ${bot2Res.data.blockedByLayer}) | ${bot2Res.data.message}`,
  );

  // --- KỊCH BẢN 3: BOT LOẠI 3 (GOM HÀNG CÙNG 1 TÀI KHOẢN - BỊ LỚP 3 CHẶN 409) ---
  console.log(
    "\n--- 3. Kiểm thử Bot Gom Hàng (Cùng 1 tài khoản mua đơn thứ 2) ---",
  );
  const userFirstBuy = await postOrder({
    userId: "hoarder_user",
    dwellTimeMs: 1500,
  });
  console.log(
    `Lần mua 1: Status = ${userFirstBuy.status} | ${userFirstBuy.data.message}`,
  );

  const userSecondBuy = await postOrder({
    userId: "hoarder_user",
    dwellTimeMs: 1500,
  });
  console.log(
    `Lần mua 2: Status = ${userSecondBuy.status} (Bị chặn bởi Lớp ${userSecondBuy.data.blockedByLayer}) | ${userSecondBuy.data.message}`,
  );

  // --- KỊCH BẢN 4: LUỒNG KHÁCH HÀNG THẬT (ĐI QUA TRỌN VẸN 100%) ---
  console.log(
    "\n--- 4. Kiểm thử Khách hàng thật (Tương tác tự nhiên 2.5s, mua lần đầu) ---",
  );
  const humanRes = await postOrder({
    userId: "real_customer_01",
    dwellTimeMs: 2500,
    isHumanFlag: true,
  });
  console.log(
    `Status = ${humanRes.status} | ${humanRes.data.message} | Mã đơn: ${humanRes.data.orderId}`,
  );

  // --- KỊCH BẢN 5: CẬP NHẬT NGƯỠNG ĐỘNG RUNTIME ---
  console.log(
    "\n--- 5. Thay đổi cấu hình ngưỡng động lúc server đang chạy ---",
  );
  const updateRes = await fetch(`${BASE_URL}/defense/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minDwellTimeMs: 500 }), // Nới lỏng ngưỡng tương tác từ 1000ms xuống 500ms
  });
  const updateData = await updateRes.json();
  console.log("Cấu hình mới áp dụng ngay lập tức:", updateData.newConfig);

  // --- KỊCH BẢN 6: XEM BÁO CÁO TỶ LỆ CHẶN NHẦM VÀ LOG TRUY VẾT ---
  console.log(
    "\n--- 6. Báo cáo tỷ lệ chặn nhầm (False Positive Rate) & Log truy vết ---",
  );
  const metricsRes = await fetch(`${BASE_URL}/defense/metrics`);
  const metrics = await metricsRes.json();
  console.log(`Tổng số lần chặn an toàn: ${metrics.totalBlocks}`);
  console.log(
    `Tỷ lệ chặn oan khách thật: ${metrics.falsePositiveRate} (Tuyệt đối không chặn nhầm)`,
  );
  console.log("Mẫu Log truy vết gần nhất:");
  console.table(metrics.logs);
}

runDemo();
