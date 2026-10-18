import { Injectable } from "@nestjs/common";

@Injectable()
export class MemoryCounterStorage {
  private ipCounters = new Map<string, { count: number; expireAt: number }>();
  private userPurchases = new Map<string, number>();

  incrementIp(ip: string, windowMs: number): number {
    const now = Date.now();
    const current = this.ipCounters.get(ip);

    if (!current || now >= current.expireAt) {
      this.ipCounters.set(ip, { count: 1, expireAt: now + windowMs });
      return 1;
    }

    current.count++;
    return current.count;
  }

  getUserPurchases(userId: string): number {
    return this.userPurchases.get(userId) || 0;
  }

  recordUserPurchase(userId: string): void {
    const current = this.getUserPurchases(userId);
    this.userPurchases.set(userId, current + 1);
  }
}
