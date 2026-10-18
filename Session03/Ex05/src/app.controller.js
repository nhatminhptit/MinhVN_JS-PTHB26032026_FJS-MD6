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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const express_1 = require("express");
const defense_engine_service_1 = require("./enforcement/defense-engine.service");
const defense_policy_1 = require("./policy/defense.policy");
let AppController = class AppController {
    defenseEngine;
    defensePolicy;
    constructor(defenseEngine, defensePolicy) {
        this.defenseEngine = defenseEngine;
        this.defensePolicy = defensePolicy;
    }
    checkout(req, res, body) {
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
            return res.status(decision.statusCode || common_1.HttpStatus.BAD_REQUEST).json({
                success: false,
                blockedByLayer: decision.blockedByLayer,
                message: decision.reason,
            });
        }
        return res.status(common_1.HttpStatus.CREATED).json({
            success: true,
            message: "Đặt đơn hàng Flash Sale thành công!",
            orderId: `ORD_${Date.now()}`,
        });
    }
    updateConfig(body) {
        const updated = this.defensePolicy.updateConfig(body);
        return { success: true, newConfig: updated };
    }
    getMetrics() {
        return this.defenseEngine.getMetrics();
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Post)("orders/flash-sale"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof express_1.Request !== "undefined" && express_1.Request) === "function" ? _a : Object, typeof (_b = typeof express_1.Response !== "undefined" && express_1.Response) === "function" ? _b : Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "checkout", null);
__decorate([
    (0, common_1.Post)("defense/config"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Get)("defense/metrics"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getMetrics", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [defense_engine_service_1.DefenseEngineService, defense_policy_1.DefensePolicy])
], AppController);
