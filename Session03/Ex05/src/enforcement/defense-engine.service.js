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
exports.DefenseEngineService = void 0;
const common_1 = require("@nestjs/common");
const memory_counter_storage_1 = require("../storage/memory-counter.storage");
const defense_policy_1 = require("../policy/defense.policy");
let DefenseEngineService = class DefenseEngineService {
    storage;
    policy;
    auditLogs = [];
    totalLegitimateRequests = 0;
    falsePositiveCount = 0;
    constructor(storage, policy) {
        this.storage = storage;
        this.policy = policy;
    }
    inspect(reqData) {
        const config = this.policy.getConfig();
        const { ip, userId, dwellTimeMs, isHumanFlag } = reqData;
        const currentCount = this.storage.incrementIp(ip, 1000);
        if (currentCount > config.maxReqPerSecPerIp) {
            this.logBlock(ip, userId, 1, `IP spam vượt ngưỡng: ${currentCount}/${config.maxReqPerSecPerIp} req/s`, dwellTimeMs);
            return {
                allowed: false,
                blockedByLayer: 1,
                reason: "Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.",
                statusCode: 429,
            };
        }
        if (dwellTimeMs < config.minDwellTimeMs) {
            this.logBlock(ip, userId, 2, `Thao tác quá nhanh (${dwellTimeMs}ms < ${config.minDwellTimeMs}ms), nghi vấn Bot`, dwellTimeMs);
            return {
                allowed: false,
                blockedByLayer: 2,
                reason: "Hệ thống phát hiện thao tác tự động bất thường.",
                statusCode: 403,
            };
        }
        const purchased = this.storage.getUserPurchases(userId);
        if (purchased >= config.maxItemsPerUser) {
            this.logBlock(ip, userId, 3, `Tài khoản đã đạt hạn mức Flash Sale (${purchased}/${config.maxItemsPerUser} đơn)`, dwellTimeMs);
            return {
                allowed: false,
                blockedByLayer: 3,
                reason: "Mỗi tài khoản chỉ được mua 1 sản phẩm Flash Sale duy nhất trong chiến dịch.",
                statusCode: 409,
            };
        }
        if (isHumanFlag) {
            this.totalLegitimateRequests++;
        }
        this.storage.recordUserPurchase(userId);
        return { allowed: true };
    }
    logBlock(ip, userId, layer, reason, dwellTimeMs) {
        const log = {
            timestamp: new Date().toISOString(),
            ip,
            userId,
            layerBlocked: layer,
            reason,
            dwellTimeMs,
        };
        this.auditLogs.push(log);
        console.log(`🛡️ [CHẶN LỚP ${layer}] [${ip} | User: ${userId}] -> ${reason}`);
    }
    getMetrics() {
        return {
            totalBlocks: this.auditLogs.length,
            falsePositiveRate: this.totalLegitimateRequests > 0
                ? `${((this.falsePositiveCount / this.totalLegitimateRequests) * 100).toFixed(2)}%`
                : "0.00%",
            logs: this.auditLogs.slice(-10),
        };
    }
};
exports.DefenseEngineService = DefenseEngineService;
exports.DefenseEngineService = DefenseEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memory_counter_storage_1.MemoryCounterStorage, defense_policy_1.DefensePolicy])
], DefenseEngineService);
