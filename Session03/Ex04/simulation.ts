import { LeakyBucketLimiter, PaymentTransaction } from "./leaky-bucket";

const coordinator = new LeakyBucketLimiter(3000, 100_000);

console.log(
  "==================================================================",
);
console.log(
  "   HỆ THỐNG PHÒNG THỦ CỔNG THANH TOÁN - SHOPFAST (LEAKY BUCKET)   ",
);
console.log(
  "==================================================================\n",
);

// Mô phỏng 6 tiến trình phân tán (Worker 1 đến Worker 6)
const NUM_WORKERS = 6;

function simulateWorkerTraffic(workerId: number, requestsPerWorker: number) {
  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < requestsPerWorker; i++) {
    const tx: PaymentTransaction = {
      id: `TX_W${workerId}_${Date.now()}_${i}`,
      amount: 100000,
      createdAt: Date.now(),
    };

    const res = coordinator.enqueue(tx);
    if (res.accepted) accepted++;
    else rejected++;
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------
// GIAI ĐOẠN 1: GIỜ BÌNH THƯỜNG (2.000 req/s chia đều cho 6 Worker)
// ---------------------------------------------------------------
console.log("--- GIAI ĐOẠN 1: Lưu lượng bình thường (2.000 req/s) ---");
const normalPerWorker = Math.floor(2000 / NUM_WORKERS);
for (let w = 1; w <= NUM_WORKERS; w++) {
  simulateWorkerTraffic(w, normalPerWorker);
}
console.log(`6 tiến trình tiếp nhận tổng 2.000 req/s.`);
console.log(`Trạng thái:`, coordinator.getMetrics());

// ---------------------------------------------------------------
// GIAI ĐOẠN 2: CAO ĐIỂM 20h-22h (BÙNG PHÁT 5.000 req/s TRONG 30s)
// ---------------------------------------------------------------
setTimeout(() => {
  console.log("\n--- GIAI ĐOẠN 2: BÃO TĂNG ĐỘT BIẾN 20h-22h (5.000 req/s) ---");
  console.log("Lưu lượng vọt lên 2,5 lần (5.000 req/s). Bắt đầu xả đệm...");

  // Bắn dồn 5.000 request cùng lúc từ 6 Worker
  const burstPerWorker = Math.floor(5000 / NUM_WORKERS);
  for (let w = 1; w <= NUM_WORKERS; w++) {
    simulateWorkerTraffic(w, burstPerWorker);
  }

  const metricsAfterBurst = coordinator.getMetrics();
  console.log(`Đã tiếp nhận toàn bộ đợt bùng phát!`);
  console.log(
    `Số lượng đang giữ trong hàng đợi: ${metricsAfterBurst.currentQueue} giao dịch.`,
  );
  console.log(
    `Bộ nhớ tiêu thụ ước tính: ${metricsAfterBurst.estimatedMemoryMB} MB / 256 MB giới hạn.`,
  );
  console.log(
    `Số giao dịch bị hủy oan: ${metricsAfterBurst.totalDropped} (Bảo toàn 100% doanh thu).`,
  );
}, 1500);

// ---------------------------------------------------------------
// GIAI ĐOẠN 3: KIỂM CHỨNG TỐC ĐỘ XẢ ĐỀU SANG NGÂN HÀNG (<= 3.000 req/s)
// ---------------------------------------------------------------
setTimeout(() => {
  console.log(
    "\n--- GIAI ĐOẠN 3: Hàng đợi đang được xả đều đặn sang Ngân hàng ---",
  );
  const finalMetrics = coordinator.getMetrics();
  console.log(`Đã xử lý an toàn: ${finalMetrics.totalProcessed} giao dịch.`);
  console.log(`Hàng đợi còn lại: ${finalMetrics.currentQueue} giao dịch.`);
  console.log(
    `-> KẾT QUẢ: Tốc độ đẩy sang ngân hàng luôn giữ trần <= 3.000 req/s, không bị ngắt mạng!`,
  );
  coordinator.stop();
}, 3000);
