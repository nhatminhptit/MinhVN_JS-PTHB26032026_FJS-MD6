import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log(
    "[Server] Hệ thống phòng thủ ShopFast sẵn sàng tại http://localhost:3000",
  );
}
bootstrap();
