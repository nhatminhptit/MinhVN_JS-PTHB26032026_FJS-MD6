import { Injectable } from "@nestjs/common";
import { TierType } from "./merchant.service";

interface CounterData {
  count: number;
  resetAt: number; 
}

@Injectable()
export class RateLimiterService {
  private storage = new Map<string, CounterData>();

  private readonly TIER_CONFIG: Record<
    TierType,
    { min: number; day: number | null }
  > = {
    FREE: { min: 60, day: 5000 },
    PRO: { min: 600, day: 200000 },
    ENTERPRISE: { min: 6000, day: null }, 
  };

  checkAndIncrement(
    identifier: string,
    tier: TierType,
    isReportEndpoint: boolean,
  ): {
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfter: number;
    resetSeconds: number;
  } {
    const now = Date.now();

    if (isReportEndpoint) {
      const reportKey = `report:${identifier}`;
      const reportLimit = 10;
      const windowMs = 3600 * 1000; // 1 giờ
      return this.evaluateLimit(reportKey, reportLimit, windowMs, now);
    }

    const minConfig = this.TIER_CONFIG[tier].min;
    const minKey = `min:${identifier}`;
    const minResult = this.evaluateLimit(minKey, minConfig, 60 * 1000, now);
    if (!minResult.allowed) return minResult;

    const dayConfig = this.TIER_CONFIG[tier].day;
    if (dayConfig !== null) {
      const dayKey = `day:${identifier}`;
      const dayResult = this.evaluateLimit(
        dayKey,
        dayConfig,
        86400 * 1000,
        now,
      );
      if (!dayResult.allowed) return dayResult;
    }

    return minResult;
  }

  private evaluateLimit(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ) {
    let item = this.storage.get(key);

    if (!item || now >= item.resetAt) {
      item = { count: 0, resetAt: now + windowMs };
      this.storage.set(key, item);
    }

    const resetSeconds = Math.max(1, Math.ceil((item.resetAt - now) / 1000));

    if (item.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfter: resetSeconds,
        resetSeconds,
      };
    }

    item.count++;
    return {
      allowed: true,
      limit,
      remaining: limit - item.count,
      retryAfter: 0,
      resetSeconds,
    };
  }
}
