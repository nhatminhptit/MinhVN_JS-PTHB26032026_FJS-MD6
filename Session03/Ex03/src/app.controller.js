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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const rate_limit_guard_1 = require("./rate-limit.guard");
const merchant_service_1 = require("./merchant.service");
let AppController = class AppController {
    merchantService;
    constructor(merchantService) {
        this.merchantService = merchantService;
    }
    getOrders() {
        return { success: true, message: "Lấy dữ liệu đơn hàng thành công." };
    }
    exportReport() {
        return {
            success: true,
            message: "Xuất báo cáo tài nguyên nặng thành công.",
        };
    }
    upgrade(body) {
        this.merchantService.upgradeTier(body.apiKey, body.newTier);
        return {
            success: true,
            message: `Nâng cấp thành công lên ${body.newTier}`,
        };
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)("orders"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)("reports/export"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "exportReport", null);
__decorate([
    (0, common_1.Post)("admin/upgrade"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "upgrade", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(rate_limit_guard_1.TierRateLimitGuard),
    __metadata("design:paramtypes", [merchant_service_1.MerchantService])
], AppController);
