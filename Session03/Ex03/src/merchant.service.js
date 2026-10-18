"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantService = void 0;
const common_1 = require("@nestjs/common");
let MerchantService = class MerchantService {
    merchants = new Map([
        [
            "key_free_123",
            { id: "M_FREE", apiKey: "key_free_123", tier: "FREE", isRevoked: false },
        ],
        [
            "key_pro_456",
            { id: "M_PRO", apiKey: "key_pro_456", tier: "PRO", isRevoked: false },
        ],
        [
            "key_ent_789",
            {
                id: "M_ENT",
                apiKey: "key_ent_789",
                tier: "ENTERPRISE",
                isRevoked: false,
            },
        ],
        [
            "key_revoked_999",
            { id: "M_BAD", apiKey: "key_revoked_999", tier: "PRO", isRevoked: true },
        ],
    ]);
    findByApiKey(apiKey) {
        if (!apiKey)
            return { isFallback: true };
        const m = this.merchants.get(apiKey);
        if (!m || m.isRevoked)
            return { isFallback: true };
        return { merchant: m, isFallback: false };
    }
    upgradeTier(apiKey, newTier) {
        const m = this.merchants.get(apiKey);
        if (m) {
            m.tier = newTier;
            console.log(`[MerchantService] ${m.id} đã được nâng cấp lên gói ${newTier}!`);
        }
    }
};
exports.MerchantService = MerchantService;
exports.MerchantService = MerchantService = __decorate([
    (0, common_1.Injectable)()
], MerchantService);
