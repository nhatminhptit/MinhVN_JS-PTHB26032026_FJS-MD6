import { Controller, Post, Body } from "@nestjs/common";

@Controller("orders")
export class OrderController {
  @Post("flash-sale")
  createFlashSaleOrder(@Body() dto: any) {
    return {
      success: true,
      message: "Đặt đơn flash sale thành công!",
    };
  }
}
