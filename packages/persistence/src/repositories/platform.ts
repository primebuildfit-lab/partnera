import { type RevenueEvent, type VaultEvent } from "@partnera/platform-finance";
import { type Collection } from "../relational/store";

/**
 * Platform-level financial + operational records (Internal OS). The two money
 * streams are **append-only** and **separate** (Revenue = Bank A, Vault = Bank B);
 * balances are always derived by folding, never stored as mutable numbers.
 * Platform alerts are mutable operational rows.
 */
export interface PlatformAlertRow {
  readonly id: string;
  readonly severity: "info" | "warning" | "critical";
  readonly category: string;
  readonly title: string;
  readonly entityRef: string | null;
  readonly status: "new" | "acknowledged" | "assigned" | "investigating" | "resolved" | "dismissed";
  readonly suggestedAction: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class PlatformRepository {
  constructor(
    private readonly revenue: Collection<RevenueEvent>,
    private readonly vault: Collection<VaultEvent>,
    private readonly alerts: Collection<PlatformAlertRow>,
  ) {}

  // --- Revenue (Bank A) — append-only ---
  appendRevenue(event: RevenueEvent): boolean {
    return this.revenue.insertIdempotent(event);
  }
  listRevenue(): RevenueEvent[] {
    return this.revenue.values();
  }

  // --- Vault (Bank B) — append-only ---
  appendVault(event: VaultEvent): boolean {
    return this.vault.insertIdempotent(event);
  }
  listVault(): VaultEvent[] {
    return this.vault.values();
  }
  listVaultForBusiness(businessId: string): VaultEvent[] {
    return this.vault.find((e) => e.businessId === businessId);
  }

  // --- Alerts (mutable) ---
  upsertAlert(alert: PlatformAlertRow): void {
    this.alerts.upsert(alert);
  }
  listAlerts(): PlatformAlertRow[] {
    return this.alerts.values();
  }
  openAlerts(): PlatformAlertRow[] {
    return this.alerts.find((a) => a.status !== "resolved" && a.status !== "dismissed");
  }

  counts(): Record<string, number> {
    return { revenue_events: this.revenue.count(), vault_events: this.vault.count(), platform_alerts: this.alerts.count() };
  }
}
