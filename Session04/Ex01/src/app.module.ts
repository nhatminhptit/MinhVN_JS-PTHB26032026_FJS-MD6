import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { ProductRepository } from "./product.repository";

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductRepository],
})
export class AppModule {}
