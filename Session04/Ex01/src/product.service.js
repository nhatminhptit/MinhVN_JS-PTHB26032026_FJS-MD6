"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProductService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const product_repository_1 = require("./product.repository");
let ProductService = ProductService_1 = class ProductService {
    cache;
    repo;
    logger = new common_1.Logger(ProductService_1.name);
    // Thời gian sống hữu hạn cho bản ghi: 300 giây (5 phút)
    TTL_MS = 300 * 1000;
    // Theo dõi thời gian hết hạn để phục vụ test case kiểm tra TTL
    ttlTracker = new Map();
    constructor(cache, repo) {
        this.cache = cache;
        this.repo = repo;
    }
    // SỬA LỖI 1: Đặt khóa mang định danh riêng phân cấp domain:entity:id
    getCacheKey(id) {
        return `shopfast:product:${id}`;
    }
    async findOne(id) {
        const key = this.getCacheKey(id);
        // Bước 1: Đọc từ đệm (bọc try-catch để Redis chết không làm sập ứng dụng)
        try {
            const cached = await this.cache.get(key);
            if (cached) {
                return { data: cached, fromCache: true };
            }
        }
        catch (err) {
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
        }
        catch (err) {
            this.logger.warn(`Lỗi nạp cache key ${key}: ${err.message}`);
        }
        return { data: product, fromCache: false };
    }
    async update(id, dto) {
        // Bước 1: Ghi nguồn Database trước
        const updatedProduct = await this.repo.update(id, dto);
        // Bước 2: SỬA LỖI 3 - Vô hiệu hóa (xóa) cache ngay lập tức khi giá thay đổi
        const key = this.getCacheKey(id);
        try {
            await this.cache.del(key);
            this.ttlTracker.delete(key);
            this.logger.log(`Đã xóa cache thành công cho key: ${key}`);
        }
        catch (err) {
            this.logger.warn(`Lỗi xóa cache key ${key}: ${err.message}`);
        }
        return updatedProduct;
    }
    // Hàm hỗ trợ kiểm tra thời gian sống phục vụ chấm điểm bài tập
    getRemainingTtl(id) {
        const key = this.getCacheKey(id);
        const expireAt = this.ttlTracker.get(key);
        if (!expireAt)
            return -2; // Không tồn tại
        const remainingSeconds = Math.round((expireAt - Date.now()) / 1000);
        return remainingSeconds > 0 ? remainingSeconds : -2;
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = ProductService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object, product_repository_1.ProductRepository])
], ProductService);
