import { Injectable } from "@nestjs/common";
import { MemoryCounterStorage } from "../storage/memory-counter.storage";
import { DefensePolicy } from "../policy/defense.policy";

export interface DefenseDecision {
  allowed: boolean;
  blockedByLayer?: number;
  reason?: string;
  statusCode?: number;
}

export interface DefenseAuditLog {
  timestamp: string;
  ip: string;
  userId: string;
  layerBlocked: number | null;
  reason: string;
  dwellTimeMs: number;
}

@Injectable()
export class DefenseEngineService {
  private auditLogs: DefenseAuditLog[] = [];
  private totalLegitimateRequests = 0;
  private falsePositiveCount = 0;

  constructor(
    private readonly storage: MemoryCounterStorage,
    private readonly policy: DefensePolicy,
  ) {}

  inspect(reqData: {
    ip: string;
    userId: string;
    dwellTimeMs: number;
    isHumanFlag?: boolean;
  }): DefenseDecision {
    const config = this.policy.getConfig();
    const { ip, userId, dwellTimeMs, isHumanFlag } = reqData;

    const currentCount = this.storage.incrementIp(ip, 1000);
    if (currentCount > config.maxReqPerSecPerIp) {
      this.logBlock(
        ip,
        userId,
        1,
        `IP spam vượt ngưỡng: ${currentCount}/${config.maxReqPerSecPerIp} req/s`,
        dwellTimeMs,
      );
      return {
        allowed: false,
        blockedByLayer: 1,
        reason: "Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.",
        statusCode: 429,
      };
    }

    if (dwellTimeMs < config.minDwellTimeMs) {
      this.logBlock(
        ip,
        userId,
        2,
        `Thao tác quá nhanh (${dwellTimeMs}ms < ${config.minDwellTimeMs}ms), nghi vấn Bot`,
        dwellTimeMs,
      );
      return {
        allowed: false,
        blockedByLayer: 2,
        reason: "Hệ thống phát hiện thao tác tự động bất thường.",
        statusCode: 403,
      };
    }

    const purchased = this.storage.getUserPurchases(userId);
    if (purchased >= config.maxItemsPerUser) {
      this.logBlock(
        ip,
        userId,
        3,
        `Tài khoản đã đạt hạn mức Flash Sale (${purchased}/${config.maxItemsPerUser} đơn)`,
        dwellTimeMs,
      );
      return {
        allowed: false,
        blockedByLayer: 3,
        reason:
          "Mỗi tài khoản chỉ được mua 1 sản phẩm Flash Sale duy nhất trong chiến dịch.",
        statusCode: 409,
      };
    }

    if (isHumanFlag) {
      this.totalLegitimateRequests++;
    }

    this.storage.recordUserPurchase(userId);
    return { allowed: true };
  }

  private logBlock(
    ip: string,
    userId: string,
    layer: number,
    reason: string,
    dwellTimeMs: number,
  ) {
    const log: DefenseAuditLog = {
      timestamp: new Date().toISOString(),
      ip,
      userId,
      layerBlocked: layer,
      reason,
      dwellTimeMs,
    };
    this.auditLogs.push(log);
    console.log(
      `🛡️ [CHẶN LỚP ${layer}] [${ip} | User: ${userId}] -> ${reason}`,
    );
  }

  getMetrics() {
    return {
      totalBlocks: this.auditLogs.length,
      falsePositiveRate:
        this.totalLegitimateRequests > 0
          ? `${((this.falsePositiveCount / this.totalLegitimateRequests) * 100).toFixed(2)}%`
          : "0.00%",
      logs: this.auditLogs.slice(-10),
    };
  }
}
