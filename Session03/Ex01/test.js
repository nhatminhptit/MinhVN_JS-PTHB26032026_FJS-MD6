async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ RATE LIMITING ===");

  // 1. Kiểm thử Flash Sale: Ngưỡng 3 lần / 60 giây
  console.log("\n--- TEST 1: Đặt đơn Flash Sale (Gọi 4 lần liên tiếp) ---");
  for (let i = 1; i <= 4; i++) {
    const res = await fetch("http://localhost:3000/orders/flash-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: "San pham flash sale" }),
    });
    const status = res.status;
    const body = await res.json();
    console.log(
      `Lần ${i}: HTTP Status = ${status} | Phản hồi:`,
      body.message || body,
    );
  }

  // 2. Kiểm thử Gửi OTP: Ngưỡng 3 lần / 5 phút
  console.log("\n--- TEST 2: Gửi OTP (Gọi 4 lần liên tiếp) ---");
  for (let i = 1; i <= 4; i++) {
    const res = await fetch("http://localhost:3000/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0912345678" }),
    });
    const status = res.status;
    const body = await res.json();
    console.log(
      `Lần ${i}: HTTP Status = ${status} | Phản hồi:`,
      body.message || body,
    );
  }
}

runTests();
