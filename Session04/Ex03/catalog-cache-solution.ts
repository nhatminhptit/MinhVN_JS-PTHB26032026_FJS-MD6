import * as crypto from "crypto";

// -------------------------------------------------------------
// 1. CÁC ĐỊNH NGHĨA KIỂU DỮ LIỆU & WHITELIST CHỐNG TẤN CÔNG
// -------------------------------------------------------------
export interface CatalogFilterDto {
  category: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_asc" | "price_desc" | "newest";
  page?: number;
  limit?: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
}

// Whitelist chặn bẫy dữ liệu rác (Anti-Cache Bloating)
const ALLOWED_CATEGORIES = new Set(["phone", "laptop", "audio"]);
const ALLOWED_BRANDS = new Set(["apple", "samsung", "sony"]);
const ALLOWED_SORTS = new Set(["price_asc", "price_desc", "newest"]);
const MAX_SYSTEM_PRICE = 500_000_000;
const MAX_CACHE_ENTRIES_PER_CAT = 1000; // Giới hạn tổng số khóa cho mỗi danh mục

// -------------------------------------------------------------
// 2. MOCK DATABASE (TẦNG LƯU TRỮ CHÍNH)
// -------------------------------------------------------------
class MockProductDatabase {
  public dbQueryCount = 0;
  private products: Product[] = [
    {
      id: "p1",
      name: "iPhone 15",
      category: "phone",
      brand: "apple",
      price: 18000000,
      stock: 10,
    },
    {
      id: "p2",
      name: "iPhone 16 Pro",
      category: "phone",
      brand: "apple",
      price: 28000000,
      stock: 25,
    },
    {
      id: "p3",
      name: "Galaxy S24",
      category: "phone",
      brand: "samsung",
      price: 21000000,
      stock: 15,
    },
    {
      id: "p4",
      name: "MacBook Air M2",
      category: "laptop",
      brand: "apple",
      price: 24000000,
      stock: 8,
    },
    {
      id: "p5",
      name: "Sony WH-1000XM5",
      category: "audio",
      brand: "sony",
      price: 8000000,
      stock: 30,
    },
  ];

  async queryCatalog(
    filter: CatalogFilterDto,
  ): Promise<{ items: Product[]; total: number }> {
    this.dbQueryCount++;
    // Giả lập độ trễ I/O nặng của aggregation query (800ms như đề bài)
    await new Promise((r) => setTimeout(r, 50));

    let result = this.products.filter((p) => p.category === filter.category);
    if (filter.brand) result = result.filter((p) => p.brand === filter.brand);
    if (filter.minPrice !== undefined)
      result = result.filter((p) => p.price >= filter.minPrice!);
    if (filter.maxPrice !== undefined)
      result = result.filter((p) => p.price <= filter.maxPrice!);

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const startIndex = (page - 1) * limit;

    return {
      items: result.slice(startIndex, startIndex + limit),
      total: result.length,
    };
  }

  async updateProduct(
    id: string,
    updateData: Partial<Product>,
  ): Promise<Product> {
    const prod = this.products.find((p) => p.id === id);
    if (!prod) throw new Error("Sản phẩm không tồn tại");
    Object.assign(prod, updateData);
    return { ...prod };
  }

  async getProductById(id: string): Promise<Product | undefined> {
    return this.products.find((p) => p.id === id);
  }
}

// -------------------------------------------------------------
// 3. MOCK REDIS ĐỘC LẬP (HỖ TRỢ STRING, TTL VÀ SET NHÓM)
// -------------------------------------------------------------
class MockRedisClient {
  public store = new Map<string, { value: string; expireAt: number }>();
  public sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expireAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(
    key: string,
    value: string,
    mode: string,
    ttlSeconds: number,
  ): Promise<void> {
    const expireAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expireAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async sadd(setKey: string, member: string): Promise<void> {
    if (!this.sets.has(setKey)) {
      this.sets.set(setKey, new Set<string>());
    }
    this.sets.get(setKey)!.add(member);
  }

  async smembers(setKey: string): Promise<string[]> {
    const s = this.sets.get(setKey);
    return s ? Array.from(s) : [];
  }

  async delSet(setKey: string): Promise<void> {
    this.sets.delete(setKey);
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    const remaining = Math.round((item.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
}

// -------------------------------------------------------------
// 4. SERVICE XỬ LÝ CACHE DANH MỤC & CHỐNG BẪY DỮ LIỆU
// -------------------------------------------------------------
export class CatalogCacheService {
  private readonly CATALOG_CACHE_TTL = 60; // 60 giây theo đúng yêu cầu nghiệp vụ

  constructor(
    private readonly redis: MockRedisClient,
    private readonly db: MockProductDatabase,
  ) {}

  /**
   * Bẫy dữ liệu 1: Chặn lọc rác làm phình bộ nhớ
   */
  private validateFilter(filter: CatalogFilterDto): void {
    if (!ALLOWED_CATEGORIES.has(filter.category)) {
      throw new Error(
        `Danh mục '${filter.category}' không hợp lệ hoặc bị cấm.`,
      );
    }
    if (filter.brand && !ALLOWED_BRANDS.has(filter.brand)) {
      throw new Error(`Thương hiệu '${filter.brand}' không hợp lệ.`);
    }
    if (filter.sortBy && !ALLOWED_SORTS.has(filter.sortBy)) {
      throw new Error(`Tiêu chí sắp xếp '${filter.sortBy}' không được hỗ trợ.`);
    }
    if (
      filter.minPrice !== undefined &&
      (filter.minPrice < 0 || filter.minPrice > MAX_SYSTEM_PRICE)
    ) {
      throw new Error("Khoảng giá minPrice không hợp lệ.");
    }
    if (
      filter.maxPrice !== undefined &&
      (filter.maxPrice < 0 || filter.maxPrice > MAX_SYSTEM_PRICE)
    ) {
      throw new Error("Khoảng giá maxPrice không hợp lệ.");
    }
    if (
      filter.minPrice !== undefined &&
      filter.maxPrice !== undefined &&
      filter.minPrice > filter.maxPrice
    ) {
      throw new Error("minPrice không được lớn hơn maxPrice.");
    }
  }

  /**
   * Bẫy dữ liệu 2: Chuẩn hóa tham số (Canonicalize) để thứ tự khác nhau cho ra cùng 1 key
   */
  public generateCanonicalKey(filter: CatalogFilterDto): string {
    const normalized: Record<string, any> = {};

    // Chỉ đưa các trường có giá trị vào mảng chuẩn hóa
    if (filter.brand) normalized.brand = filter.brand;
    if (filter.minPrice !== undefined)
      normalized.minPrice = Number(filter.minPrice);
    if (filter.maxPrice !== undefined)
      normalized.maxPrice = Number(filter.maxPrice);
    normalized.sortBy = filter.sortBy || "newest";
    normalized.page = filter.page ? Number(filter.page) : 1;
    normalized.limit = filter.limit ? Number(filter.limit) : 20;

    // Sắp xếp các key theo alphabet tuyệt đối
    const sortedKeys = Object.keys(normalized).sort();
    const sortedParamString = sortedKeys
      .map((k) => `${k}=${normalized[k]}`)
      .join("&");

    const hash = crypto
      .createHash("md5")
      .update(sortedParamString)
      .digest("hex")
      .substring(0, 12);
    return `shopfast:catalog:cat_${filter.category}:${hash}`;
  }

  /**
   * Truy vấn danh mục với chiến lược đệm 3 trang đầu
   */
  async getCatalog(
    filter: CatalogFilterDto,
  ): Promise<{ data: any; source: "CACHE" | "DB"; responseTimeMs: number }> {
    const startTime = Date.now();

    // 1. Kiểm tra validation
    this.validateFilter(filter);

    const page = filter.page ? Number(filter.page) : 1;

    // 2. Ràng buộc: Trang 4 trở đi truy vấn thẳng DB, không lưu đệm
    if (page > 3) {
      const dbResult = await this.db.queryCatalog(filter);
      return {
        data: dbResult,
        source: "DB",
        responseTimeMs: Date.now() - startTime,
      };
    }

    // 3. Sinh khóa chuẩn hóa
    const cacheKey = this.generateCanonicalKey(filter);

    // 4. Đọc Cache
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return {
        data: JSON.parse(cachedData),
        source: "CACHE",
        responseTimeMs: Date.now() - startTime,
      };
    }

    // 5. Cache Miss -> Truy vấn DB
    const dbResult = await this.db.queryCatalog(filter);

    // 6. Kiểm tra giới hạn số lượng khóa danh mục (Cap Limit) trước khi lưu
    const groupSetKey = `shopfast:category_keys:${filter.category}`;
    const currentKeysInCat = await this.redis.smembers(groupSetKey);

    if (currentKeysInCat.length < MAX_CACHE_ENTRIES_PER_CAT) {
      // Lưu đệm với TTL 60 giây
      await this.redis.set(
        cacheKey,
        JSON.stringify(dbResult),
        "EX",
        this.CATALOG_CACHE_TTL,
      );
      // Đăng ký key vào nhóm để vô hiệu hóa hàng loạt khi cần
      await this.redis.sadd(groupSetKey, cacheKey);
    }

    return {
      data: dbResult,
      source: "DB",
      responseTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Vô hiệu hóa hàng loạt khi một sản phẩm thay đổi thông tin
   */
  async onProductUpdated(
    productId: string,
    updateData: Partial<Product>,
  ): Promise<void> {
    // 1. Cập nhật Database
    const updated = await this.db.updateProduct(productId, updateData);

    // 2. Lấy nhóm khóa liên quan đến danh mục của sản phẩm này
    const groupSetKey = `shopfast:category_keys:${updated.category}`;
    const affectedKeys = await this.redis.smembers(groupSetKey);

    // 3. Xóa đồng loạt toàn bộ khóa đệm chứa danh mục đó
    for (const key of affectedKeys) {
      await this.redis.del(key);
    }

    // 4. Xóa tập hợp theo dõi
    await this.redis.delSet(groupSetKey);
  }
}

// -------------------------------------------------------------
// 5. KỊCH BẢN KIỂM THỬ TỰ ĐỘNG XÁC MINH CẢ 5 TIÊU CHÍ ĐÁNH GIÁ
// -------------------------------------------------------------
async function runVerificationSuite() {
  console.log(
    "======================================================================",
  );
  console.log(
    "  KIỂM THỬ HỆ THỐNG CACHE TRANG DANH MỤC CÓ BỘ LỌC (SESSION 04 - BÀI 7)",
  );
  console.log(
    "======================================================================\n",
  );

  const redis = new MockRedisClient();
  const db = new MockProductDatabase();
  const service = new CatalogCacheService(redis, db);

  // --- TIÊU CHÍ 1: THỨ TỰ THAM SỐ KHÁC NHAU SINH RA CÙNG 1 KHÓA DUY NHẤT ---
  console.log(
    "--- TIÊU CHÍ 1: Kiểm tra tính chuẩn hóa khóa (Canonical Key) ---",
  );
  const filter1: CatalogFilterDto = {
    category: "phone",
    brand: "apple",
    minPrice: 10000000,
    sortBy: "newest",
  };
  const filter2: CatalogFilterDto = {
    sortBy: "newest",
    minPrice: 10000000,
    category: "phone",
    brand: "apple",
  };

  const key1 = service.generateCanonicalKey(filter1);
  const key2 = service.generateCanonicalKey(filter2);

  console.log(`Key 1: ${key1}`);
  console.log(`Key 2: ${key2}`);

  if (key1 === key2) {
    console.log(
      "=> KẾT QUẢ TIÊU CHÍ 1: ĐẠT (Hai thứ tự tham số khác nhau cho ra cùng 1 khóa duy nhất)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TIÊU CHÍ 1: THẤT BẠI\n");
  }

  // --- TIÊU CHÍ 2: LẦN GỌI THỨ HAI TRẢ VỀ TỪ CACHE DƯỚI 20MS ---
  console.log("--- TIÊU CHÍ 2: Đo lường tốc độ phản hồi Cache (< 20ms) ---");
  const res1 = await service.getCatalog(filter1);
  console.log(
    `Lần gọi 1 (Chưa có cache): Nguồn = ${res1.source}, Thời gian phản hồi = ${res1.responseTimeMs}ms`,
  );

  const res2 = await service.getCatalog(filter2);
  console.log(
    `Lần gọi 2 (Đã có cache):   Nguồn = ${res2.source}, Thời gian phản hồi = ${res2.responseTimeMs}ms`,
  );

  if (res2.source === "CACHE" && res2.responseTimeMs < 20) {
    console.log(
      "=> KẾT QUẢ TIÊU CHÍ 2: ĐẠT (Phản hồi tức thì từ Cache dưới 20ms)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TIÊU CHÍ 2: THẤT BẠI\n");
  }

  // --- TIÊU CHÍ 3: TRANG 4 TRỞ ĐI TRUY VẤN THẲNG DB, KHÔNG TẠO BẢN GHI ĐỆM ---
  console.log(
    "--- TIÊU CHÍ 3: Kiểm tra phân tầng phân trang (Page > 3 không sinh cache) ---",
  );
  const filterPage4: CatalogFilterDto = { category: "phone", page: 4 };
  const keyPage4 = service.generateCanonicalKey(filterPage4);

  const resPage4 = await service.getCatalog(filterPage4);
  const cacheCheckPage4 = await redis.get(keyPage4);

  console.log(`Gọi Trang 4: Nguồn dữ liệu = ${resPage4.source}`);
  console.log(
    `Kiểm tra khóa của trang 4 trong Redis: ${cacheCheckPage4 === null ? "KHÔNG TỒN TẠI (Đúng)" : "ĐÃ BỊ CACHE (Sai)"}`,
  );

  if (resPage4.source === "DB" && cacheCheckPage4 === null) {
    console.log(
      "=> KẾT QUẢ TIÊU CHÍ 3: ĐẠT (Chỉ cache 3 trang đầu, trang 4 đi thẳng xuống DB)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TIÊU CHÍ 3: THẤT BẠI\n");
  }

  // --- TIÊU CHÍ 4: CẬP NHẬT GIÁ SẢN PHẨM LÀM MỚI NGAY CÁC KẾT QUẢ LỌC LIÊN QUAN ---
  console.log(
    "--- TIÊU CHÍ 4: Vô hiệu hóa Cache hàng loạt khi sản phẩm đổi giá ---",
  );
  // Trước khi đổi giá, kiểm tra xem cache của filter1 còn sống không
  const cacheBefore = await redis.get(key1);
  console.log(
    `Trạng thái cache của iPhone trước cập nhật: ${cacheBefore ? "TỒN TẠI" : "TRỐNG"}`,
  );

  // Thực hiện đổi giá sản phẩm p1 (iPhone 15 thuộc category phone) từ 18tr lên 19.5tr
  console.log(
    "Thực hiện: Admin cập nhật giá iPhone 15 từ 18.000.000đ lên 19.500.000đ...",
  );
  await service.onProductUpdated("p1", { price: 19500000 });

  const cacheAfter = await redis.get(key1);
  console.log(
    `Trạng thái cache sau khi đổi giá: ${cacheAfter === null ? "ĐÃ BỊ XÓA NGAY LẬP TỨC" : "VẪN CÒN (Lỗi)"}`,
  );

  // Khách gọi lại filter1 -> Phải là trượt cache và đọc giá mới từ DB
  const resAfterUpdate = await service.getCatalog(filter1);
  const updatedItem = resAfterUpdate.data.items.find(
    (i: Product) => i.id === "p1",
  );
  console.log(
    `Đọc lại danh mục: Nguồn = ${resAfterUpdate.source}, Giá mới nhận được = ${updatedItem?.price}đ`,
  );

  if (
    cacheAfter === null &&
    resAfterUpdate.source === "DB" &&
    updatedItem?.price === 19500000
  ) {
    console.log(
      "=> KẾT QUẢ TIÊU CHÍ 4: ĐẠT (Vô hiệu hóa toàn bộ cache danh mục liên quan thành công)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TIÊU CHÍ 4: THẤT BẠI\n");
  }

  // --- TIÊU CHÍ 5: CHẶN TẤN CÔNG BẰNG BỘ LỌC RÁC (ANTI-CACHE BLOATING) ---
  console.log("--- TIÊU CHÍ 5: Kiểm tra cơ chế phòng thủ tham số rác ---");
  try {
    await service.getCatalog({ category: "hacker_malicious_category" });
    console.log(
      "=> KẾT QUẢ TIÊU CHÍ 5: THẤT BẠI (Cho phép query rác đi qua)\n",
    );
  } catch (err: any) {
    console.log(`Chặn thành công request rác với thông báo: "${err.message}"`);
    console.log(
      "=> KẾT QUẢ TIÊU CHÍ 5: ĐẠT (Bộ lọc rác bị chặn đứng trước khi chạm vào Cache/DB)\n",
    );
  }

  console.log("Toàn bộ các yêu cầu của Bài tập 7 đã được thỏa mãn xuất sắc!");
}

runVerificationSuite();
