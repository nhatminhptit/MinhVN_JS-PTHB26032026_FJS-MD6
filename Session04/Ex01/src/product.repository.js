"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductRepository = void 0;
const common_1 = require("@nestjs/common");
let ProductRepository = class ProductRepository {
    // Giả lập bảng products trong database
    products = new Map([
        [
            "prod_A",
            {
                id: "prod_A",
                name: "Áo thun ShopFast Classic",
                price: 100000,
                stock: 50,
            },
        ],
        [
            "prod_B",
            { id: "prod_B", name: "Quần Jeans Slimfit", price: 300000, stock: 20 },
        ],
    ]);
    async findById(id) {
        const product = this.products.get(id);
        return product ? { ...product } : null;
    }
    async update(id, dto) {
        const product = this.products.get(id);
        if (!product) {
            throw new Error(`Sản phẩm với mã ${id} không tồn tại.`);
        }
        const updated = { ...product, ...dto };
        this.products.set(id, updated);
        return { ...updated };
    }
};
exports.ProductRepository = ProductRepository;
exports.ProductRepository = ProductRepository = __decorate([
    (0, common_1.Injectable)()
], ProductRepository);
