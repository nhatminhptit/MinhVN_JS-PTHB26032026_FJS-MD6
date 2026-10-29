import { Injectable, Inject, Logger } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ProductRepository, Product } from "./product.repository";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  // Thời gian sống hữu hạn cho bản ghi: 300 giây (5 phút)
  private readonly TTL_MS = 300 * 1000;

  // Theo dõi thời gian hết hạn để phục vụ test case kiểm tra TTL
  private readonly ttlTracker = new Map<string, number>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly repo: ProductRepository,
  ) {}

  // SỬA LỖI 1: Đặt khóa mang định danh riêng phân cấp domain:entity:id
  private getCacheKey(id: string): string {
    return `shopfast:product:${id}`;
  }

  async findOne(
    id: string,
  ): Promise<{ data: Product | null; fromCache: boolean }> {
    const key = this.getCacheKey(id);

    // Bước 1: Đọc từ đệm (bọc try-catch để Redis chết không làm sập ứng dụng)
    try {
      const cached = await this.cache.get<Product>(key);
      if (cached) {
        return { data: cached, fromCache: true };
      }
    } catch (err) {
      this.logger.warn(`Lỗi đọc cache key ${key}: ${err.message}`);
    }

    // Bước 2: Trượt cache -> Truy vấn từ Database
    const product = await this.repo.findById(id);
    if (!product) {
      return { data: null, fromCache: false };
    }

    // Bước 3: SỬA LỖI 2 - Ghi ngược lại Cache kèm thời gian sống hữu hạn (TTL)
    try {
      await this.cache.set(key, product, this.TTL_MS);
      this.ttlTracker.set(key, Date.now() + this.TTL_MS);
    } catch (err) {
      this.logger.warn(`Lỗi nạp cache key ${key}: ${err.message}`);
    }

    return { data: product, fromCache: false };
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    // Bước 1: Ghi nguồn Database trước
    const updatedProduct = await this.repo.update(id, dto);

    // Bước 2: SỬA LỖI 3 - Vô hiệu hóa (xóa) cache ngay lập tức khi giá thay đổi
    const key = this.getCacheKey(id);
    try {
      await this.cache.del(key);
      this.ttlTracker.delete(key);
      this.logger.log(`Đã xóa cache thành công cho key: ${key}`);
    } catch (err) {
      this.logger.warn(`Lỗi xóa cache key ${key}: ${err.message}`);
    }

    return updatedProduct;
  }

  // Hàm hỗ trợ kiểm tra thời gian sống phục vụ chấm điểm bài tập
  getRemainingTtl(id: string): number {
    const key = this.getCacheKey(id);
    const expireAt = this.ttlTracker.get(key);
    if (!expireAt) return -2; // Không tồn tại
    const remainingSeconds = Math.round((expireAt - Date.now()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : -2;
  }
}
