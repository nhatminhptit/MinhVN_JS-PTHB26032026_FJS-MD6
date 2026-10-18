"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefensePolicy = void 0;
const common_1 = require("@nestjs/common");
let DefensePolicy = class DefensePolicy {
    config = {
        maxReqPerSecPerIp: 3,
        minDwellTimeMs: 1000,
        maxItemsPerUser: 1,
    };
    getConfig() {
        return { ...this.config };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log("[Policy] Ngưỡng phòng thủ đã được cập nhật nóng:", this.config);
        return this.getConfig();
    }
};
exports.DefensePolicy = DefensePolicy;
exports.DefensePolicy = DefensePolicy = __decorate([
    (0, common_1.Injectable)()
], DefensePolicy);
