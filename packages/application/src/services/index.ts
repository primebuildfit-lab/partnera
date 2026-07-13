import { type PayoutRail } from "@partnera/payment-engine";
import { type AppDeps } from "../context";
import { AuditService, ConfigurationService, NotificationService } from "./admin";
import { CreatorService } from "./creator";
import { FraudService } from "./fraud";
import { LedgerService } from "./ledger";
import { OfferService } from "./offer";
import { OrganizationService } from "./organization";
import { PaymentService } from "./payment";
import { QueryService } from "./query";
import { TrackingService } from "./tracking";

export * from "./organization";
export * from "./offer";
export * from "./tracking";
export * from "./ledger";
export * from "./payment";
export * from "./fraud";
export * from "./admin";
export * from "./query";
export * from "./creator";

/** The full set of application services, constructed over one set of dependencies. */
export interface Services {
  readonly organizations: OrganizationService;
  readonly offers: OfferService;
  readonly tracking: TrackingService;
  readonly ledger: LedgerService;
  readonly payments: PaymentService;
  readonly fraud: FraudService;
  readonly notifications: NotificationService;
  readonly configuration: ConfigurationService;
  readonly audit: AuditService;
  readonly query: QueryService;
  readonly creator: CreatorService;
}

/** Build every application service from shared dependencies (and an optional payout rail). */
export function createServices(deps: AppDeps, rail?: PayoutRail): Services {
  return {
    organizations: new OrganizationService(deps),
    offers: new OfferService(deps),
    tracking: new TrackingService(deps),
    ledger: new LedgerService(deps),
    payments: new PaymentService(deps, rail),
    fraud: new FraudService(deps),
    notifications: new NotificationService(deps),
    configuration: new ConfigurationService(deps),
    audit: new AuditService(deps),
    query: new QueryService(deps),
    creator: new CreatorService(deps),
  };
}
