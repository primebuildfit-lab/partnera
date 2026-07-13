# Analytics — Creator Marketplace

> **Part 15.** Metrics per role. Reuses `@partnera/analytics` (metric events, KPIs, funnels)
> and derives everything from the append-only ledger + domain events — never from faked or
> mutable aggregates. All analytics are permission-gated and scope-limited.

## Platform Admin

Network health and liquidity:
- gross creator payments · platform fees (recognized/reversed, net) · businesses active ·
  creators active · submissions (volume) · **approval rate** · **dispute rate** · **fraud
  rate** · **payment failure rate** · marketplace liquidity (open opportunities vs. active
  creators; time-to-first-submission; fill rate) · top content categories · reviewer SLA
  adherence.

## Business

Program performance and spend:
- creator spending (vs. budget) · submissions received · approval rate · revision rate ·
  content produced · content used by affiliates · **content-attributed sales** (where
  attribution is wired, OQ-32) · best creators · best-performing assets · budget remaining ·
  time-to-review.

## Creator

Own performance only:
- jobs completed · approval rate · earnings (gross/fees/net, by period) · revisions ·
  reputation (with explanation) · companies worked with · best content types · payment
  history.

## Affiliate

Content usage and outcomes (own scope):
- assets unlocked · assets used · campaigns · clicks · conversions · sales · performance by
  content asset (which creator content converts best).

## Method & guarantees

- **Derived, not stored as truth**: money metrics fold the ledger; funnel/volume metrics
  come from domain events. A balance-snapshot-style cache may exist for speed but is always
  rebuildable (mirrors D-212).
- **Scope**: a business sees only its tenant; a creator/affiliate only their own records;
  admin sees network aggregates via audited operator scope.
- **Explainability**: reputation and attributed-sales figures link back to the underlying
  events/records.
- **Funnels**: e.g. opportunity views → applications → accepted → submitted → approved →
  paid; and unlocked → used → clicked → converted for affiliate content.
- **Exports**: entitlement-gated ([ENTITLEMENTS.md](ENTITLEMENTS.md)).
