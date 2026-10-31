import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get } from "@nestjs/common";

@Controller()
class AppController {
  @Get("health")
  getHealth() {
    return { status: "healthy", timestamp: new Date().toISOString() };
  }

  @Get()
  getHello() {
    return { message: "ShopFast API is running smoothly!" };
  }
}

@Module({
  controllers: [AppController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[ShopFast] Server running on port ${port}`);
}
bootstrap();
