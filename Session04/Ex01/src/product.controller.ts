import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  NotFoundException,
} from "@nestjs/common";
import { ProductService } from "./product.service";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const result = await this.productService.findOne(id);
    if (!result.data) {
      throw new NotFoundException(`Không tìm thấy sản phẩm ${id}`);
    }
    return {
      product: result.data,
      fromCache: result.fromCache,
    };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    const updated = await this.productService.update(id, dto);
    return {
      message: "Cập nhật sản phẩm thành công",
      product: updated,
    };
  }

  @Get(":id/ttl")
  getTtl(@Param("id") id: string) {
    const ttl = this.productService.getRemainingTtl(id);
    return {
      productId: id,
      remainingTtlSeconds: ttl,
    };
  }
}
