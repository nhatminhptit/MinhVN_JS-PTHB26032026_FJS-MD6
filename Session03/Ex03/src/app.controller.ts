import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { TierRateLimitGuard } from "./rate-limit.guard";
import { MerchantService } from "./merchant.service";

@Controller()
@UseGuards(TierRateLimitGuard)
export class AppController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get("orders")
  getOrders() {
    return { success: true, message: "Lấy dữ liệu đơn hàng thành công." };
  }

  @Get("reports/export")
  exportReport() {
    return {
      success: true,
      message: "Xuất báo cáo tài nguyên nặng thành công.",
    };
  }

  @Post("admin/upgrade")
  upgrade(@Body() body: { apiKey: string; newTier: any }) {
    this.merchantService.upgradeTier(body.apiKey, body.newTier);
    return {
      success: true,
      message: `Nâng cấp thành công lên ${body.newTier}`,
    };
  }
}
