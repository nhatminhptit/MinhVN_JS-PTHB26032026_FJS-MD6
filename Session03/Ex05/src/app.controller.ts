import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { DefenseEngineService } from "./enforcement/defense-engine.service";
import { DefensePolicy, DefenseConfig } from "./policy/defense.policy";

@Controller()
export class AppController {
  constructor(
    private readonly defenseEngine: DefenseEngineService,
    private readonly defensePolicy: DefensePolicy,
  ) {}

  @Post("orders/flash-sale")
  checkout(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
    const userId = body.userId || "anonymous";
    const dwellTimeMs = Number(body.dwellTimeMs) || 0;
    const isHumanFlag = Boolean(body.isHumanFlag);

    const decision = this.defenseEngine.inspect({
      ip,
      userId,
      dwellTimeMs,
      isHumanFlag,
    });

    if (!decision.allowed) {
      return res.status(decision.statusCode || HttpStatus.BAD_REQUEST).json({
        success: false,
        blockedByLayer: decision.blockedByLayer,
        message: decision.reason,
      });
    }

    return res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Đặt đơn hàng Flash Sale thành công!",
      orderId: `ORD_${Date.now()}`,
    });
  }

  @Post("defense/config")
  updateConfig(@Body() body: Partial<DefenseConfig>) {
    const updated = this.defensePolicy.updateConfig(body);
    return { success: true, newConfig: updated };
  }

  @Get("defense/metrics")
  getMetrics() {
    return this.defenseEngine.getMetrics();
  }
}
