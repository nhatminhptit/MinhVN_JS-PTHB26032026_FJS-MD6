"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TierRateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const merchant_service_1 = require("./merchant.service");
const rate_limiter_service_1 = require("./rate-limiter.service");
let TierRateLimitGuard = class TierRateLimitGuard {
    merchantService;
    rateLimiterService;
    constructor(merchantService, rateLimiterService) {
        this.merchantService = merchantService;
        this.rateLimiterService = rateLimiterService;
    }
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const apiKey = req.headers["x-api-key"];
        const clientIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
        const { merchant, isFallback } = this.merchantService.findByApiKey(apiKey);
        const tier = isFallback ? "FREE" : merchant.tier;
        const identifier = isFallback
            ? `ip:${clientIp}`
            : `merchant:${merchant.id}`;
        const isReportEndpoint = req.path?.includes("/reports/export") ||
            req.url?.includes("/reports/export");
        const result = this.rateLimiterService.checkAndIncrement(identifier, tier, isReportEndpoint);
        res.setHeader("RateLimit-Limit", String(result.limit));
        res.setHeader("RateLimit-Remaining", String(result.remaining));
        res.setHeader("RateLimit-Reset", String(result.resetSeconds));
        if (!result.allowed) {
            res.setHeader("Retry-After", String(result.retryAfter));
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                error: "RATE_LIMIT_EXCEEDED",
                message: `Bạn đã dùng hết hạn mức của gói ${tier}. Vui lòng thử lại sau ${result.retryAfter} giây.`,
                retryAfterSeconds: result.retryAfter,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
};
exports.TierRateLimitGuard = TierRateLimitGuard;
exports.TierRateLimitGuard = TierRateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [merchant_service_1.MerchantService, rate_limiter_service_1.RateLimiterService])
], TierRateLimitGuard);
