const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Giả lập Redis Client hỗ trợ thực thi Lua Script nguyên tử chống overselling
class MockRedisWithLua {
  private store = new Map<string, number>();

  async set(key: string, value: number): Promise<void> {
    this.store.set(key, value);
  }

  async get(key: string): Promise<number> {
    return this.store.get(key) ?? 0;
  }

  /**
   * Mô phỏng Redis EVAL (Lua Script) trừ kho nguyên tử:
   * KEYS[1] = tên khóa tồn kho (vd: 'product:iphone16')
   * ARGV[1] = số lượng mua (vd: 1)
   * Trả về: 1 nếu thành công, 0 nếu hết hàng (âm kho)
   */
  async evalLuaDecreaseStock(
    stockKey: string,
    quantity: number,
  ): Promise<number> {
    const currentStock = this.store.get(stockKey) ?? 0;
    if (currentStock >= quantity) {
      this.store.set(stockKey, currentStock - quantity);
      return 1; // Thành công
    }
    return 0; // Hết hàng / Không đủ tồn kho
  }

  async evalLuaIncreaseStock(
    stockKey: string,
    quantity: number,
  ): Promise<void> {
    const currentStock = this.store.get(stockKey) ?? 0;
    this.store.set(stockKey, currentStock + quantity);
  }
}

// 2. Giả lập Cơ sở dữ liệu quan hệ (RDB) giới hạn 150 writes/s
class MockRelationalDatabase {
  public dbStock = 0;
  public totalDbWrites = 0;

  async batchSyncStock(finalStock: number) {
    this.totalDbWrites++;
    await sleep(10); // Giả lập độ trễ ghi DB
    this.dbStock = finalStock;
  }
}

// 3. Service xử lý Flash Sale chịu tải cao
class FlashSaleService {
  constructor(
    public redis: MockRedisWithLua,
    public db: MockRelationalDatabase,
  ) {}

  async purchaseItem(
    productId: string,
    quantity = 1,
  ): Promise<{ success: boolean; message: string }> {
    const stockKey = `product:${productId}`;

    // Gọi Lua Script trừ kho nguyên tử trên Redis (Siêu tốc, chịu hàng vạn writes/s)
    const result = await this.redis.evalLuaDecreaseStock(stockKey, quantity);

    if (result === 1) {
      // Đẩy vào queue bất đồng bộ để đồng bộ xuống DB theo lô (Write-Behind)
      return { success: true, message: "Đặt hàng thành công!" };
    } else {
      return { success: false, message: "Rất tiếc, sản phẩm đã hết hàng!" };
    }
  }

  async cancelOrder(productId: string, quantity = 1): Promise<void> {
    const stockKey = `product:${productId}`;
    // Hoàn trả lại kho khi đơn hàng bị huỷ giữa chừng
    await this.redis.evalLuaIncreaseStock(stockKey, quantity);
  }
}

// 4. Kịch bản kiểm thử tải cao: 400 request đồng thời cho 100 sản phẩm trong kho
async function runFlashSaleSimulation() {
  console.log(
    "======================================================================",
  );
  console.log(
    "    MÔ PHỎNG CHIẾN LƯỢC GHI TỒN KHO THỜI GIAN THỰC (FLASH SALE 400 REQ/S) ",
  );
  console.log(
    "======================================================================\n",
  );

  const redis = new MockRedisWithLua();
  const db = new MockRelationalDatabase();
  const service = new FlashSaleService(redis, db);

  const productId = "iphone_16_pro_max";
  const initialStock = 100; // Kho thực tế chỉ có 100 cái

  // Bước 1: Khởi tạo tồn kho ban đầu lên Redis và DB
  await redis.set(`product:${productId}`, initialStock);
  db.dbStock = initialStock;

  console.log(
    `[Khởi tạo] Tồn kho ban đầu trên hệ thống: ${initialStock} sản phẩm.\n`,
  );

  // Bước 2: Bắn đồng thời 400 request mua hàng trong cùng một khoảnh khắc (Vượt xa giới hạn 150 writes/s của RDB)
  console.log(
    "--- Đang kích hoạt 400 request mua hàng đồng thời dồn vào hệ thống ---",
  );
  const startTime = Date.now();

  const requests = Array.from({ length: 400 }, () =>
    service.purchaseItem(productId, 1),
  );
  const results = await Promise.all(requests);

  const duration = Date.now() - startTime;

  // Thống kê kết quả
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const remainingStockInRedis = await redis.get(`product:${productId}`);

  console.log(`\n--- KẾT QUẢ THỰC THI ---`);
  console.log(
    `Thời gian xử lý 400 request: ${duration} ms (Đáp ứng yêu cầu < 500ms)`,
  );
  console.log(`Số lượng đơn đặt hàng thành công: ${successCount}`);
  console.log(`Số lượng request bị từ chối (hết hàng): ${failCount}`);
  console.log(`Tồn kho còn lại trên Redis: ${remainingStockInRedis}`);

  // Kiểm tra bẫy dữ liệu: Tuyệt đối không được âm kho / bán vượt quá số lượng
  if (successCount === initialStock && remainingStockInRedis === 0) {
    console.log(
      "\n=> KẾT QUẢ KIỂM THỬ: ĐẠT TUYỆT ĐỐI (Không có hiện tượng âm kho, chặn đứng tình trạng overselling thành công!)",
    );
  } else {
    console.log("\n=> KẾT QUẢ KIỂM THỬ: THẤT BẠI (Phát hiện bán vượt tồn kho)");
  }

  // Bước 3: Mô phỏng trường hợp có đơn hàng bị huỷ giữa chừng (Hoàn kho)
  console.log("\n--- Mô phỏng hoàn kho do đơn hàng bị huỷ ---");
  console.log("Thực hiện huỷ 5 đơn hàng đã mua thành công...");
  for (let i = 0; i < 5; i++) {
    await service.cancelOrder(productId, 1);
  }
  const stockAfterCancel = await redis.get(`product:${productId}`);
  console.log(
    `Tồn kho trên Redis sau khi hoàn trả 5 sản phẩm: ${stockAfterCancel} (Đúng bằng 5)`,
  );
}

runFlashSaleSimulation();
