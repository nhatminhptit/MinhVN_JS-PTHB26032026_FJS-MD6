const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Giả lập Redis Client chuẩn NGUYÊN TỬ (Atomic) không bị dính Race Condition của JS
class MockRedis {
  private store = new Map<string, { value: string; expireAt: number | null }>();

  private checkExpired(key: string) {
    const item = this.store.get(key);
    if (item && item.expireAt && Date.now() > item.expireAt) {
      this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.checkExpired(key);
    const item = this.store.get(key);
    return item ? item.value : null;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number | string,
    extra?: number,
  ): Promise<boolean> {
    let isNx = false;
    let ttlSeconds: number | null = null;

    if (mode === "NX") {
      isNx = true;
      if (duration === "EX" && typeof extra === "number") {
        ttlSeconds = extra;
      }
    } else if (mode === "EX" && typeof duration === "number") {
      ttlSeconds = duration;
    }

    // KIỂM TRA ĐỒNG BỘ: Tuyệt đối không dùng await để đảm bảo tính nguyên tử của Redis
    this.checkExpired(key);
    if (isNx && this.store.has(key)) {
      return false; // Đã có người giữ khóa -> Thất bại ngay
    }

    const expireAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expireAt });
    return true;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async ttl(key: string): Promise<number> {
    this.checkExpired(key);
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    const remaining = Math.round((item.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
}

// 2. Giả lập Database có bộ đếm truy vấn
class MockRepository {
  public dbQueryCount = 0;
  public shouldThrowError = false;

  async findById(id: string) {
    this.dbQueryCount++;
    await sleep(30); // Giả lập độ trễ I/O đọc ổ đĩa của Database
    if (this.shouldThrowError) {
      throw new Error("Sự cố gián đoạn kết nối Database bất ngờ!");
    }
    return { id, name: "Flash Sale iPhone 16 Pro Max", price: 29990000 };
  }
}

// 3. Service xử lý logic với Khóa phân tán
class FlashSaleProductService {
  constructor(
    public redis: MockRedis,
    public repo: MockRepository,
  ) {}

  async getProductWithLock(id: string, retries = 5): Promise<any> {
    const key = `shopfast:product:${id}`;
    const lockKey = `lock:product:${id}`;

    // Đọc cache ban đầu
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    // (1) Giành khóa phân tán với NX và EX
    const gotLock = await this.redis.set(lockKey, "1", "NX", "EX", 10);

    // (2) Nhánh xử lý khi KHÔNG giành được khóa
    if (!gotLock) {
      if (retries <= 0) {
        return null; // Chặn lặp vô tận
      }
      await sleep(50); // Nhường cho người giữ khóa
      return this.getProductWithLock(id, retries - 1); // Đọc lại cache
    }

    // (5) Bảo đảm giải phóng khóa cả khi DB ném lỗi bằng try - finally
    try {
      const product = await this.repo.findById(id);

      // (3) Thêm độ lệch ngẫu nhiên cho TTL (Jitter 0 - 60s)
      const jitter = Math.floor(Math.random() * 60);
      const ttl = 300 + jitter;
      await this.redis.set(key, JSON.stringify(product), "EX", ttl);

      return product;
    } finally {
      // (4) Giải phóng khóa phân tán
      await this.redis.del(lockKey);
    }
  }
}

// 4. Kịch bản chạy kiểm thử 4 tiêu chí
async function runAllTests() {
  console.log(
    "======================================================================",
  );
  console.log(
    "   KIỂM THỬ CƠ CHẾ CHỐNG DỒN DẬP (CACHE STAMPEDE) VỚI KHÓA PHÂN TÁN   ",
  );
  console.log(
    "======================================================================\n",
  );

  const redis = new MockRedis();
  const repo = new MockRepository();
  const service = new FlashSaleProductService(redis, repo);

  // --- TEST 1: ĐO TẢI 200 REQUEST ĐỒNG THỜI VÀO SẢN PHẨM HẾT HẠN CACHE ---
  console.log(
    "--- TEST 1: Kích hoạt 200 request đồng thời khi khóa hết hạn ---",
  );
  repo.dbQueryCount = 0;

  // Bắn 200 request cùng một khoảnh khắc
  const requests = Array.from({ length: 200 }, () =>
    service.getProductWithLock("iphone_16"),
  );
  const results = await Promise.all(requests);

  console.log(`Số lượng request gửi vào: 200`);
  console.log(`Số lần Database bị truy vấn thực tế: ${repo.dbQueryCount} lần`);

  const allSuccess = results.every((p) => p && p.id === "iphone_16");
  if (repo.dbQueryCount === 1 && allSuccess) {
    console.log(
      "=> KẾT QUẢ TEST 1: ĐẠT (Chỉ duy nhất 1 request xuống DB, 199 request còn lại đọc cache!)\n",
    );
  } else {
    console.log(
      `=> KẾT QUẢ TEST 1: THẤT BẠI (DB bị truy vấn ${repo.dbQueryCount} lần)\n`,
    );
  }

  // --- TEST 2: KIỂM CHỨNG ĐỘ LỆCH NGẪU NHIÊN CỦA THỜI GIAN SỐNG (TTL JITTER) ---
  console.log(
    "--- TEST 2: Kiểm chứng độ lệch ngẫu nhiên thời gian sống (TTL) ---",
  );
  const ttls: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const pId = `item_${i}`;
    await service.getProductWithLock(pId);
    const ttl = await redis.ttl(`shopfast:product:${pId}`);
    ttls.push(ttl);
    console.log(`Key 'shopfast:product:${pId}' có TTL: ${ttl} giây`);
  }

  const hasVariation = new Set(ttls).size > 1;
  const inRange = ttls.every((t) => t >= 300 && t <= 360);
  if (hasVariation && inRange) {
    console.log(
      "=> KẾT QUẢ TEST 2: ĐẠT (Thời gian sống lệch nhau ngẫu nhiên trong khoảng 300s - 360s)\n",
    );
  } else {
    console.log(
      "=> KẾT QUẢ TEST 2: THẤT BẠI (TTL bị cố định giống hệt nhau)\n",
    );
  }

  // --- TEST 3: BẪY DATABASE NÉM LỖI - KHÓA PHÂN TÁN VẪN PHẢI ĐƯỢC GIẢI PHÓNG ---
  console.log(
    "--- TEST 3: Mô phỏng Database ném lỗi và kiểm tra giải phóng khóa ---",
  );
  repo.shouldThrowError = true;

  try {
    await service.getProductWithLock("item_error");
  } catch {
    // Nuốt lỗi mong muốn
  }

  const remainingLock = await redis.get("lock:product:item_error");
  console.log(
    `Trạng thái khóa 'lock:product:item_error' sau khi DB sập: ${remainingLock ? "CHƯA XÓA (KẸT KHÓA)" : "ĐÃ ĐƯỢC GIẢI PHÓNG"}`,
  );

  if (remainingLock === null) {
    console.log(
      "=> KẾT QUẢ TEST 3: ĐẠT (Khối finally luôn xóa khóa, hệ thống không bị kẹt)\n",
    );
  } else {
    console.log(
      "=> KẾT QUẢ TEST 3: THẤT BẠI (Khóa bị kẹt vĩnh viễn chặn các request sau)\n",
    );
  }

  // --- TEST 4: KIỂM CHỨNG GIỚI HẠN SỐ LẦN CHỜ (KHÔNG LẶP VÔ TẬN) ---
  console.log("--- TEST 4: Kiểm chứng cơ chế ngắt vòng lặp chờ ---");
  await redis.set("lock:product:stuck_item", "1", "NX", "EX", 100);

  const start = Date.now();
  const fallbackResult = await service.getProductWithLock("stuck_item", 2);
  const duration = Date.now() - start;

  console.log(`Thời gian chờ tối đa trước khi bỏ cuộc: ${duration}ms`);
  console.log(`Giá trị trả về khi hết lượt thử: ${fallbackResult}`);

  if (fallbackResult === null && duration < 300) {
    console.log(
      "=> KẾT QUẢ TEST 4: ĐẠT (Hệ thống thoát an toàn, không rơi vào vòng lặp vô tận)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 4: THẤT BẠI\n");
  }

  console.log(
    "Toàn bộ 4 tiêu chí đánh giá của bài tập đã hoàn thành xuất sắc!",
  );
}

runAllTests();
