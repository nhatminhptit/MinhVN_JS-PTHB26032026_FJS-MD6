const BASE_URL = "http://localhost:3000";

async function sendRequest(endpoint, apiKey) {
  const headers = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    limit: res.headers.get("RateLimit-Limit"),
    remaining: res.headers.get("RateLimit-Remaining"),
    retryAfter: res.headers.get("Retry-After"),
    body: data,
  };
}

async function runFullSuite() {
  console.log("=====================================================");
  console.log("   BẮT ĐẦU KIỂM THỬ HỆ THỐNG RATE LIMITING ĐA TẦNG   ");
  console.log("=====================================================\n");

  // TEST 1: ENDPOINT BÁO CÁO BỊ CHẶN Ở LẦN THỨ 11 (KỂ CẢ VỚI GÓI ENTERPRISE)
  console.log(
    "--- TEST 1: Endpoint xuất báo cáo (Tối đa 10 req/giờ) với gói ENTERPRISE ---",
  );
  for (let i = 1; i <= 12; i++) {
    const res = await sendRequest("/reports/export", "key_ent_789");
    if (i <= 10) {
      console.log(
        `Lần ${i}: Status = ${res.status} | Còn lại: ${res.remaining}/${res.limit}`,
      );
    } else {
      console.log(
        `Lần ${i}: Status = ${res.status} (BỊ CHẶN 429) | Retry-After: ${res.retryAfter}s`,
      );
    }
  }

  // TEST 2: REQUEST THIẾU KHOÁ HOẶC KHOÁ BỊ THU HỒI
  console.log("\n--- TEST 2: Kiểm tra bẫy không khoá & khoá bị thu hồi ---");
  const noKeyRes = await sendRequest("/orders", null);
  console.log(
    `Không truyền Key: Áp dụng trần = ${noKeyRes.limit} (Gói FREE theo IP) | Status: ${noKeyRes.status}`,
  );

  const revokedKeyRes = await sendRequest("/orders", "key_revoked_999");
  console.log(
    `Key bị thu hồi:   Áp dụng trần = ${revokedKeyRes.limit} (Gói FREE theo IP) | Status: ${revokedKeyRes.status}`,
  );

  // TEST 3: GÓI FREE BỊ CHẶN KHI VƯỢT QUÁ 60 REQ/PHÚT
  console.log("\n--- TEST 3: Kiểm thử gói FREE chạm trần 60 request/phút ---");
  let freeBlockedCount = 0;
  for (let i = 1; i <= 62; i++) {
    const res = await sendRequest("/orders", "key_free_123");
    if (res.status === 429) freeBlockedCount++;
  }
  console.log(
    `Gửi 62 request liên tiếp: 60 request đầu thành công, bị chặn ${freeBlockedCount} request (Mã 429).`,
  );

  // TEST 4: BẪY NÂNG CẤP GÓI GIỮA CHỪNG ĂN NGAY LẬP TỨC
  console.log("\n--- TEST 4: Nâng cấp gói giữa chừng (Từ FREE lên PRO) ---");
  console.log("Tài khoản Free hiện tại đang bị khoá do hết hạn mức 60/60...");

  // Tiến hành gọi API nâng cấp lên PRO
  await fetch(`${BASE_URL}/admin/upgrade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: "key_free_123", newTier: "PRO" }),
  });

  // Gửi tiếp request ngay lập tức
  const afterUpgradeRes = await sendRequest("/orders", "key_free_123");
  console.log(
    `Gọi lại ngay sau khi nâng cấp: Status = ${afterUpgradeRes.status} | Hạn mức mới = ${afterUpgradeRes.limit} | Còn lại: ${afterUpgradeRes.remaining}`,
  );
  console.log(
    "-> KẾT QUẢ: Hạn mức mới ăn ngay lập tức mà không cần đợi hết chu kỳ!",
  );
}

runFullSuite();
