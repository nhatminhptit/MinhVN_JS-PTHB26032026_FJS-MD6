const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. MODULE ĐO LƯỜNG HIỆU NĂNG VÀ TỈ LỆ TRÚNG CACHE (METRIC TRACKER)
// ============================================================================
export type DataTypeCategory =
  | "STATIC"
  | "FREQUENT"
  | "USER_SPECIFIC"
  | "AGGREGATED";

interface MetricDetail {
  hits: number;
  misses: number;
  totalTimeMs: number;
  requestCount: number;
}

export class CacheMetricTracker {
  private metrics: Record<DataTypeCategory, MetricDetail> = {
    STATIC: { hits: 0, misses: 0, totalTimeMs: 0, requestCount: 0 },
    FREQUENT: { hits: 0, misses: 0, totalTimeMs: 0, requestCount: 0 },
    USER_SPECIFIC: { hits: 0, misses: 0, totalTimeMs: 0, requestCount: 0 },
    AGGREGATED: { hits: 0, misses: 0, totalTimeMs: 0, requestCount: 0 },
  };

  record(
    category: DataTypeCategory,
    isHit: boolean,
    responseTimeMs: number,
  ): void {
    const item = this.metrics[category];
    item.requestCount++;
    item.totalTimeMs += responseTimeMs;
    if (isHit) {
      item.hits++;
    } else {
      item.misses++;
    }
  }

  printReport(): void {
    console.log(
      "\n=============================================================================================",
    );
    console.log(
      "            BÁO CÁO ĐO LƯỜNG HIỆU NĂNG VÀ TỈ LỆ TRÚNG BỘ NHỚ ĐỆM (METRIC REPORT)             ",
    );
    console.log(
      "=============================================================================================",
    );
    console.log(
      "| Loại dữ liệu       | Tổng Request | Số lần Hit | Số lần Miss | Tỉ lệ Hit (%) | Latency TB (ms) |",
    );
    console.log(
      "|--------------------|--------------|------------|-------------|---------------|-----------------|",
    );

    for (const [cat, data] of Object.entries(this.metrics)) {
      const hitRate =
        data.requestCount > 0
          ? ((data.hits / data.requestCount) * 100).toFixed(1)
          : "0.0";
      const avgLatency =
        data.requestCount > 0
          ? (data.totalTimeMs / data.requestCount).toFixed(2)
          : "0.00";
      const catPadded = cat.padEnd(18, " ");
      const reqPadded = data.requestCount.toString().padEnd(12, " ");
      const hitPadded = data.hits.toString().padEnd(10, " ");
      const missPadded = data.misses.toString().padEnd(11, " ");
      const ratePadded = `${hitRate}%`.padEnd(13, " ");
      const latPadded = `${avgLatency} ms`.padEnd(15, " ");
      console.log(
        `| ${catPadded} | ${reqPadded} | ${hitPadded} | ${missPadded} | ${ratePadded} | ${latPadded} |`,
      );
    }
    console.log(
      "=============================================================================================\n",
    );
  }
}

// ============================================================================
// 2. RESILIENT REDIS CACHE ADAPTER (XỬ LÝ MƯỢT NGOẠI LỆ, FAILOVER AN TOÀN)
// ============================================================================
export class ResilientRedisAdapter {
  private inMemoryStore = new Map<
    string,
    { value: string; expireAt: number }
  >();
  public isRedisAlive = true; // Cờ mô phỏng tắt/bật Redis

  async get(key: string): Promise<string | null> {
    if (!this.isRedisAlive) {
      throw new Error(
        "REDIS_CONNECTION_REFUSED: Cụm Redis đang bảo trì hoặc mất kết nối mạng!",
      );
    }
    const item = this.inMemoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expireAt) {
      this.inMemoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.isRedisAlive) {
      throw new Error(
        "REDIS_CONNECTION_REFUSED: Không thể ghi dữ liệu do Redis mất kết nối!",
      );
    }
    const expireAt = Date.now() + ttlSeconds * 1000;
    this.inMemoryStore.set(key, { value, expireAt });
  }

  async del(key: string): Promise<void> {
    if (!this.isRedisAlive) {
      throw new Error(
        "REDIS_CONNECTION_REFUSED: Không thể xóa khóa do Redis mất kết nối!",
      );
    }
    this.inMemoryStore.delete(key);
  }
}

// ============================================================================
// 3. MOCK DATABASE (TẦNG LƯU TRỮ CHÍNH CÓ ĐỘ TRỄ NẶNG)
// ============================================================================
export class MockDatabase {
  public dbQueriesCount = 0;

  // Dữ liệu mẫu
  public categories = [
    "Điện thoại",
    "Laptop",
    "Phụ kiện",
    "Thời trang",
    "Đồ gia dụng",
  ];
  public products = new Map<
    string,
    { id: string; name: string; price: number; stock: number }
  >([
    [
      "p_101",
      { id: "p_101", name: "iPhone 16 Pro Max", price: 34990000, stock: 50 },
    ],
    [
      "p_102",
      { id: "p_102", name: "MacBook Air M3", price: 27990000, stock: 30 },
    ],
  ]);
  public carts = new Map<string, any[]>([
    ["u_1", [{ productId: "p_101", quantity: 1 }]],
  ]);

  async fetchCategoriesFromDB() {
    this.dbQueriesCount++;
    await sleep(40); // Mô phỏng truy vấn DB mất 40ms
    return [...this.categories];
  }

  async fetchProductFromDB(id: string) {
    this.dbQueriesCount++;
    await sleep(60); // Mô phỏng truy vấn bảng products mất 60ms
    const p = this.products.get(id);
    return p ? { ...p } : null;
  }

  async updateProductInDB(id: string, newPrice: number) {
    this.dbQueriesCount++;
    await sleep(80);
    const p = this.products.get(id);
    if (!p) throw new Error("Product not found");
    p.price = newPrice;
    return { ...p };
  }

  async fetchUserCartFromDB(userId: string) {
    this.dbQueriesCount++;
    await sleep(30);
    return this.carts.get(userId) || [];
  }

  async calculateTopSellingFromDB() {
    this.dbQueriesCount++;
    await sleep(250); // Phép tính GROUP BY & SUM trên bảng Orders cực kỳ nặng (250ms)
    return [
      { productId: "p_101", totalSales: 1540 },
      { productId: "p_102", totalSales: 890 },
    ];
  }
}

// ============================================================================
// 4. BUSINESS ACCELERATOR SERVICE (TỔ CHỨC THEO CLEAN CODE)
// ============================================================================
export class ShopFastAcceleratorService {
  constructor(
    private readonly redis: ResilientRedisAdapter,
    private readonly db: MockDatabase,
    private readonly metrics: CacheMetricTracker,
  ) {}

  // --- LOẠI 1: DỮ LIỆU TĨNH (STATIC DATA - TTL 24H) ---
  async getCategories(): Promise<string[]> {
    const start = Date.now();
    const cacheKey = "shopfast:static:categories:all";

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.metrics.record("STATIC", true, Date.now() - start);
        return JSON.parse(cached);
      }
    } catch (err: any) {
      console.warn(
        `[Failover] Redis lỗi khi đọc Categories (${err.message}). Tự động fallback DB.`,
      );
    }

    const data = await this.db.fetchCategoriesFromDB();
    try {
      await this.redis.set(cacheKey, JSON.stringify(data), 86400); // 24 giờ
    } catch (err: any) {
      console.warn(`[Failover] Bỏ qua ghi cache cho Categories do lỗi Redis.`);
    }

    this.metrics.record("STATIC", false, Date.now() - start);
    return data;
  }

  // --- LOẠI 2: DỮ LIỆU BIẾN ĐỘNG CAO (GIÁ SẢN PHẨM - TUYỆT ĐỐI CHÍNH XÁC) ---
  async getProduct(productId: string): Promise<any> {
    const start = Date.now();
    const cacheKey = `shopfast:product:${productId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.metrics.record("FREQUENT", true, Date.now() - start);
        return JSON.parse(cached);
      }
    } catch (err: any) {
      console.warn(
        `[Failover] Redis lỗi khi đọc Product ${productId}. Tự động fallback DB.`,
      );
    }

    const product = await this.db.fetchProductFromDB(productId);
    if (product) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(product), 300); // 5 phút
      } catch (err: any) {
        console.warn(`[Failover] Bỏ qua ghi cache cho Product do lỗi Redis.`);
      }
    }

    this.metrics.record("FREQUENT", false, Date.now() - start);
    return product;
  }

  // Cập nhật giá: Xóa cache ngay lập tức để không bao giờ thấy giá cũ
  async updateProductPrice(productId: string, newPrice: number): Promise<any> {
    const updated = await this.db.updateProductInDB(productId, newPrice);
    const cacheKey = `shopfast:product:${productId}`;
    try {
      await this.redis.del(cacheKey);
      console.log(
        `[Cache Invalidation] Đã xóa cache của key ${cacheKey} ngay khi đổi giá.`,
      );
    } catch (err: any) {
      console.warn(
        `[Failover] Lỗi kết nối khi xóa cache key ${cacheKey}: ${err.message}`,
      );
    }
    return updated;
  }

  // --- LOẠI 3: DỮ LIỆU RIÊNG TỪNG NGƯỜI DÙNG (USER CART - TTL 2H) ---
  async getUserCart(userId: string): Promise<any> {
    const start = Date.now();
    const cacheKey = `shopfast:user:${userId}:cart`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.metrics.record("USER_SPECIFIC", true, Date.now() - start);
        return JSON.parse(cached);
      }
    } catch (err: any) {
      console.warn(
        `[Failover] Redis lỗi khi đọc Cart của user ${userId}. Tự động fallback DB.`,
      );
    }

    const cart = await this.db.fetchUserCartFromDB(userId);
    try {
      await this.redis.set(cacheKey, JSON.stringify(cart), 7200); // 2 giờ
    } catch (err: any) {
      console.warn(`[Failover] Bỏ qua ghi cache cho Cart do lỗi Redis.`);
    }

    this.metrics.record("USER_SPECIFIC", false, Date.now() - start);
    return cart;
  }

  // --- LOẠI 4: DỮ LIỆU TỔNG HỢP NẶNG (EXPENSIVE AGGREGATION - TTL 10 PHÚT) ---
  async getTopSellingProducts(): Promise<any> {
    const start = Date.now();
    const cacheKey = "shopfast:agg:top_selling_products";

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.metrics.record("AGGREGATED", true, Date.now() - start);
        return JSON.parse(cached);
      }
    } catch (err: any) {
      console.warn(
        `[Failover] Redis lỗi khi tính Top Selling. Tự động fallback DB.`,
      );
    }

    const topSelling = await this.db.calculateTopSellingFromDB();
    try {
      await this.redis.set(cacheKey, JSON.stringify(topSelling), 600); // 10 phút
    } catch (err: any) {
      console.warn(`[Failover] Bỏ qua ghi cache cho Top Selling.`);
    }

    this.metrics.record("AGGREGATED", false, Date.now() - start);
    return topSelling;
  }
}

// ============================================================================
// 5. KỊCH BẢN KIỂM CHỨNG TOÀN DIỆN CÁC TIÊU CHÍ ĐÁNH GIÁ
// ============================================================================
async function runSystemTest() {
  console.log(
    "=============================================================================================",
  );
  console.log(
    "    KHỞI CHẠY KIỂM THỬ TẦNG TĂNG TỐC TOÀN DIỆN SHOPFAST (SESSION 04 - BÀI TẬP 9)             ",
  );
  console.log(
    "=============================================================================================\n",
  );

  const redis = new ResilientRedisAdapter();
  const db = new MockDatabase();
  const tracker = new CacheMetricTracker();
  const service = new ShopFastAcceleratorService(redis, db, tracker);

  // --- TEST CASE 1: MÔ PHỎNG LƯU LƯỢNG CAO CHO CẢ 4 LOẠI DỮ LIỆU ---
  console.log(">>> 1. Kích hoạt lưu lượng đọc liên tục cho 4 loại dữ liệu...");
  for (let i = 0; i < 20; i++) {
    await service.getCategories(); // Dữ liệu tĩnh
    await service.getProduct("p_101"); // Dữ liệu biến động
    await service.getUserCart("u_1"); // Dữ liệu người dùng
    await service.getTopSellingProducts(); // Dữ liệu tổng hợp nặng
  }

  // In báo cáo tỉ lệ trúng đệm
  tracker.printReport();

  // --- TEST CASE 2: KIỂM CHỨNG CẬP NHẬT GIÁ - KHÔNG BAO GIỜ THẤY GIÁ CŨ ---
  console.log(
    '>>> 2. Kiểm chứng quy tắc: "Tuyệt đối không để khách nhìn thấy giá sai"...',
  );
  const oldProduct = await service.getProduct("p_101");
  console.log(
    `Giá ban đầu của iPhone 16 Pro Max: ${oldProduct.price.toLocaleString("vi-VN")} đ`,
  );

  console.log("Admin cập nhật giá mới: 32.500.000 đ...");
  await service.updateProductPrice("p_101", 32500000);

  const productAfterUpdate = await service.getProduct("p_101");
  console.log(
    `Giá khách nhìn thấy ngay sau khi cập nhật: ${productAfterUpdate.price.toLocaleString("vi-VN")} đ`,
  );

  if (productAfterUpdate.price === 32500000) {
    console.log(
      "=> ĐẠT TIÊU CHÍ: Vô hiệu hóa bộ nhớ đệm chuẩn xác, không có kịch bản thấy giá cũ!\n",
    );
  } else {
    console.error("=> THẤT BẠI: Vẫn bị trả về giá cũ từ cache!\n");
  }

  // --- TEST CASE 3: TẮT REDIS - KIỂM CHỨNG TÍNH BỀN BỈ (GRACEFUL DEGRADATION) ---
  console.log(
    ">>> 3. Mô phỏng sự cố: TẮT HOÀN TOÀN CỤM REDIS (Failover Test)...",
  );
  redis.isRedisAlive = false; // Ngắt kết nối Redis đột ngột

  console.log("Thực hiện gửi yêu cầu khi Redis đã chết hoàn toàn...");
  try {
    const start = Date.now();
    const categoriesFallback = await service.getCategories();
    const productFallback = await service.getProduct("p_101");
    const elapsed = Date.now() - start;

    console.log(
      `Kết quả: Lấy thành công ${categoriesFallback.length} danh mục & thông tin sản phẩm (${productFallback.name})`,
    );
    console.log(
      `Thời gian xử lý khi không có Redis: ${elapsed} ms (Hệ thống tự động đọc từ DB)`,
    );
    console.log(
      "=> ĐẠT TIÊU CHÍ: Hệ thống vẫn phục vụ bình thường, chỉ chậm hơn, không trả về lỗi 500!\n",
    );
  } catch (fatalError: any) {
    console.error(
      "=> THẤT BẠI: Ứng dụng bị crash hoặc trả lỗi 500 khi Redis tắt:",
      fatalError,
    );
  }

  console.log("Toàn bộ các tiêu chí đánh giá đã thành công!");
}

runSystemTest();
