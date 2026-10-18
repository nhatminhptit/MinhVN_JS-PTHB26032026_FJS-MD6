import { Injectable } from "@nestjs/common";

export interface DefenseConfig {
  maxReqPerSecPerIp: number;
  minDwellTimeMs: number;
  maxItemsPerUser: number;
}

@Injectable()
export class DefensePolicy {
  private config: DefenseConfig = {
    maxReqPerSecPerIp: 3,
    minDwellTimeMs: 1000,
    maxItemsPerUser: 1,
  };

  getConfig(): DefenseConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DefenseConfig>): DefenseConfig {
    this.config = { ...this.config, ...newConfig };
    console.log(
      "[Policy] Ngưỡng phòng thủ đã được cập nhật nóng:",
      this.config,
    );
    return this.getConfig();
  }
}
