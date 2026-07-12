import {
  type AffiliateId,
  asId,
  type CommissionId,
  type FraudCaseId,
  type OfferId,
  type OrderId,
  type PayoutId,
  type UserId,
} from "@partnera/core";
import { type Services } from "@partnera/application";
import { type HttpRequest, type HttpResponse, Router } from "./router";

const ok = (body: unknown, status = 200): HttpResponse => ({ status, body });
const bodyOf = <T>(req: HttpRequest): T => (req.body ?? {}) as T;

/**
 * Register the platform's HTTP surface over the application services. Every
 * handler simply delegates to a permission-aware service; authorization,
 * tenant-scoping, validation, idempotency, and audit all live in the service,
 * so the delivery layer stays thin and uniform. This mirrors the resource list
 * in Part 8 (organizations, offers, tracking, ledger, balances, fraud,
 * notifications, configuration) plus the payout money-out path.
 */
export function buildApiRouter(services: Services): Router {
  const r = new Router();

  // --- Organizations & tenancy ---
  r.route("POST", "/organizations", (req) =>
    ok(services.organizations.createOrganization(req.ctx, bodyOf(req)), 201),
  );
  r.route("POST", "/businesses", (req) =>
    ok(services.organizations.createBusiness(req.ctx, bodyOf(req)), 201),
  );

  // --- Offers ---
  r.route("GET", "/offers", (req) => ok(services.offers.listOffers(req.ctx)));
  r.route("POST", "/offers", (req) => ok(services.offers.createOffer(req.ctx, bodyOf(req)), 201));
  r.route("POST", "/offers/:offerId/versions", (req) =>
    ok(services.offers.addVersion(req.ctx, asId<OfferId>(req.params.offerId!), bodyOf(req)), 201),
  );
  r.route("POST", "/offers/:offerId/activate", async (req) => {
    const { version } = bodyOf<{ version: number }>(req);
    return ok(await services.offers.activate(req.ctx, asId<OfferId>(req.params.offerId!), version));
  });
  r.route("POST", "/offers/:offerId/simulate", (req) =>
    ok(services.offers.simulate(req.ctx, asId<OfferId>(req.params.offerId!), bodyOf(req))),
  );

  // --- Tracking & the money spine ---
  r.route("POST", "/tracking/links", (req) => {
    services.tracking.createLink(req.ctx, bodyOf(req));
    return ok({ ok: true }, 201);
  });
  r.route("POST", "/tracking/orders", (req) =>
    ok(services.tracking.ingestOrder(req.ctx, bodyOf(req)), 201),
  );
  r.route("POST", "/tracking/orders/:orderId/convert", async (req) =>
    ok(
      await services.tracking.processConversion(req.ctx, {
        ...bodyOf<Record<string, unknown>>(req),
        orderId: asId<OrderId>(req.params.orderId!),
      }),
    ),
  );
  r.route("POST", "/tracking/refunds", async (req) =>
    ok(await services.tracking.recordRefund(req.ctx, bodyOf(req))),
  );

  // --- Ledger & balances ---
  r.route("GET", "/ledger/commissions/:commissionId", async (req) =>
    ok(await services.ledger.getCommission(req.ctx, asId<CommissionId>(req.params.commissionId!))),
  );
  r.route("POST", "/ledger/commissions/:commissionId/approve", async (req) => {
    await services.ledger.approve(req.ctx, asId<CommissionId>(req.params.commissionId!));
    return ok({ ok: true });
  });
  r.route("POST", "/ledger/commissions/:commissionId/adjust", async (req) => {
    await services.ledger.adjust(req.ctx, asId<CommissionId>(req.params.commissionId!), bodyOf(req));
    return ok({ ok: true });
  });
  r.route("GET", "/balances/:affiliateId", async (req) =>
    ok(await services.ledger.balances(req.ctx, asId<AffiliateId>(req.params.affiliateId!))),
  );

  // --- Payouts (money out) ---
  r.route("POST", "/payouts", async (req) =>
    ok(await services.payments.requestPayout(req.ctx, bodyOf(req)), 201),
  );
  r.route("POST", "/payouts/:payoutId/approve", async (req) => {
    await services.payments.approve(req.ctx, asId<PayoutId>(req.params.payoutId!));
    return ok({ ok: true });
  });
  r.route("POST", "/payouts/:payoutId/execute", async (req) =>
    ok(await services.payments.execute(req.ctx, asId<PayoutId>(req.params.payoutId!))),
  );

  // --- Fraud ---
  r.route("GET", "/fraud/cases", (req) => ok(services.fraud.listCases(req.ctx)));
  r.route("POST", "/fraud/assess", async (req) => ok(await services.fraud.assess(req.ctx, bodyOf(req))));
  r.route("POST", "/fraud/cases/:caseId/review", async (req) =>
    ok(await services.fraud.review(req.ctx, asId<FraudCaseId>(req.params.caseId!), bodyOf(req))),
  );

  // --- Notifications ---
  r.route("GET", "/notifications/:userId", (req) =>
    ok(services.notifications.listForRecipient(req.ctx, asId<UserId>(req.params.userId!))),
  );

  // --- Configuration ---
  r.route("GET", "/config/:key", async (req) =>
    ok({ key: req.params.key, value: await services.configuration.get(req.ctx, req.params.key!) }),
  );
  r.route("POST", "/config", async (req) => {
    const { key, value } = bodyOf<{ key: string; value: unknown }>(req);
    await services.configuration.set(req.ctx, key, value);
    return ok({ ok: true });
  });

  return r;
}
