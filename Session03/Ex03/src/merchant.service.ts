import { Injectable } from "@nestjs/common";

export type TierType = "FREE" | "PRO" | "ENTERPRISE";

export interface Merchant {
  id: string;
  apiKey: string;
  tier: TierType;
  isRevoked: boolean;
}

@Injectable()
export class MerchantService {
  private merchants = new Map<string, Merchant>([
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

  findByApiKey(apiKey?: string): { merchant?: Merchant; isFallback: boolean } {
    if (!apiKey) return { isFallback: true };
    const m = this.merchants.get(apiKey);
    if (!m || m.isRevoked) return { isFallback: true };
    return { merchant: m, isFallback: false };
  }

  upgradeTier(apiKey: string, newTier: TierType) {
    const m = this.merchants.get(apiKey);
    if (m) {
      m.tier = newTier;
      console.log(
        `[MerchantService] ${m.id} đã được nâng cấp lên gói ${newTier}!`,
      );
    }
  }
}
