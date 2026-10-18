import { Controller, Post, Body } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

@Controller("auth")
export class AuthController {
  @Throttle({ default: { ttl: 300000, limit: 3 } })
  @Post("send-otp")
  sendOtp(@Body() dto: any) {
    return {
      success: true,
      message: "Mã OTP đã được gửi đến điện thoại thành công!",
    };
  }
}
