"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCounterStorage = void 0;
const common_1 = require("@nestjs/common");
let MemoryCounterStorage = class MemoryCounterStorage {
    ipCounters = new Map();
    userPurchases = new Map();
    incrementIp(ip, windowMs) {
        const now = Date.now();
        const current = this.ipCounters.get(ip);
        if (!current || now >= current.expireAt) {
            this.ipCounters.set(ip, { count: 1, expireAt: now + windowMs });
            return 1;
        }
        current.count++;
        return current.count;
    }
    getUserPurchases(userId) {
        return this.userPurchases.get(userId) || 0;
    }
    recordUserPurchase(userId) {
        const current = this.getUserPurchases(userId);
        this.userPurchases.set(userId, current + 1);
    }
};
exports.MemoryCounterStorage = MemoryCounterStorage;
exports.MemoryCounterStorage = MemoryCounterStorage = __decorate([
    (0, common_1.Injectable)()
], MemoryCounterStorage);
