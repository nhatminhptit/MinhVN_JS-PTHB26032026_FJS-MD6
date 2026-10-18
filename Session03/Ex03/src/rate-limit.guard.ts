import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { MerchantService } from "./merchant.service";
import { RateLimiterService } from "./rate-limiter.service";

@Injectable()
export class TierRateLimitGuard implements CanActivate {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const apiKey = req.headers["x-api-key"] as string;
    const clientIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";

    const { merchant, isFallback } = this.merchantService.findByApiKey(apiKey);
    const tier = isFallback ? "FREE" : merchant.tier;
    const identifier = isFallback
      ? `ip:${clientIp}`
      : `merchant:${merchant.id}`;

    const isReportEndpoint =
      req.path?.includes("/reports/export") ||
      req.url?.includes("/reports/export");

    const result = this.rateLimiterService.checkAndIncrement(
      identifier,
      tier,
      isReportEndpoint,
    );

    res.setHeader("RateLimit-Limit", String(result.limit));
    res.setHeader("RateLimit-Remaining", String(result.remaining));
    res.setHeader("RateLimit-Reset", String(result.resetSeconds));

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "RATE_LIMIT_EXCEEDED",
          message: `Bạn đã dùng hết hạn mức của gói ${tier}. Vui lòng thử lại sau ${result.retryAfter} giây.`,
          retryAfterSeconds: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
