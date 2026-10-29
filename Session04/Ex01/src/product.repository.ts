import { Injectable } from "@nestjs/common";
import { UpdateProductDto } from "./dto/update-product.dto";

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class ProductRepository {
  // Giả lập bảng products trong database
  private readonly products = new Map<string, Product>([
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

  async findById(id: string): Promise<Product | null> {
    const product = this.products.get(id);
    return product ? { ...product } : null;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = this.products.get(id);
    if (!product) {
      throw new Error(`Sản phẩm với mã ${id} không tồn tại.`);
    }
    const updated = { ...product, ...dto };
    this.products.set(id, updated);
    return { ...updated };
  }
}
