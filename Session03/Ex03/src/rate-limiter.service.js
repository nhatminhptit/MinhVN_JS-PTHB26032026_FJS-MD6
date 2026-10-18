"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterService = void 0;
const common_1 = require("@nestjs/common");
let RateLimiterService = class RateLimiterService {
    storage = new Map();
    TIER_CONFIG = {
        FREE: { min: 60, day: 5000 },
        PRO: { min: 600, day: 200000 },
        ENTERPRISE: { min: 6000, day: null },
    };
    checkAndIncrement(identifier, tier, isReportEndpoint) {
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
        if (!minResult.allowed)
            return minResult;
        const dayConfig = this.TIER_CONFIG[tier].day;
        if (dayConfig !== null) {
            const dayKey = `day:${identifier}`;
            const dayResult = this.evaluateLimit(dayKey, dayConfig, 86400 * 1000, now);
            if (!dayResult.allowed)
                return dayResult;
        }
        return minResult;
    }
    evaluateLimit(key, limit, windowMs, now) {
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
};
exports.RateLimiterService = RateLimiterService;
exports.RateLimiterService = RateLimiterService = __decorate([
    (0, common_1.Injectable)()
], RateLimiterService);
