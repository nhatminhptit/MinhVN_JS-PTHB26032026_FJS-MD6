import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { MerchantService } from "./merchant.service";
import { RateLimiterService } from "./rate-limiter.service";
import { TierRateLimitGuard } from "./rate-limit.guard";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [MerchantService, RateLimiterService, TierRateLimitGuard],
})
export class AppModule {}
