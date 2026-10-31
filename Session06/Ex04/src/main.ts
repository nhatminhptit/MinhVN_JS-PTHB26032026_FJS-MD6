import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kích hoạt tính năng đón nhận tín hiệu dừng từ hệ thống (SIGTERM)
  app.enableShutdownHooks();

  const server = await app.listen(3000);

  // Xử lý đóng kết nối êm đẹp (Graceful Shutdown)
  process.on("SIGTERM", () => {
    console.log(
      "[System] Nhận tín hiệu SIGTERM. Bắt đầu xả kết nối (Connection Draining)...",
    );
    server.close(() => {
      console.log(
        "[System] Toàn bộ kết nối HTTP và Realtime đã đóng an toàn. Dừng tiến trình.",
      );
      process.exit(0);
    });
  });
}
bootstrap();
