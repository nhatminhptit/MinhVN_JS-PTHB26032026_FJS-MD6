export interface PaymentTransaction {
  id: string;
  amount: number;
  createdAt: number;
}

export class LeakyBucketLimiter {
  private readonly leakRatePerSecond: number;
  private readonly maxQueueCapacity: number;
  private queue: PaymentTransaction[] = [];
  private totalProcessed = 0;
  private totalDropped = 0;
  private leakTimer: NodeJS.Timeout | null = null;

  constructor(leakRate = 3000, maxQueueSize = 100_000) {
    this.leakRatePerSecond = leakRate;
    this.maxQueueCapacity = maxQueueSize;
    this.startLeaking();
  }

  enqueue(tx: PaymentTransaction): { accepted: boolean; queueLength: number } {
    if (this.queue.length >= this.maxQueueCapacity) {
      this.totalDropped++;
      return { accepted: false, queueLength: this.queue.length };
    }

    this.queue.push(tx);
    return { accepted: true, queueLength: this.queue.length };
  }

  private startLeaking() {
    const intervalMs = 100;
    const batchSize = Math.floor(this.leakRatePerSecond / (1000 / intervalMs));

    this.leakTimer = setInterval(() => {
      if (this.queue.length === 0) return;

      const toProcess = this.queue.splice(0, batchSize);
      this.totalProcessed += toProcess.length;
    }, intervalMs);
  }

  getMetrics() {
    return {
      currentQueue: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      estimatedMemoryMB: ((this.queue.length * 150) / (1024 * 1024)).toFixed(2),
    };
  }

  stop() {
    if (this.leakTimer) clearInterval(this.leakTimer);
  }
}
