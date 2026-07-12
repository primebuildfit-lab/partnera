# API & Event Contracts — Creator Marketplace

> **Part 13.** Provider-independent API contracts and append-only domain events.
> Documentation-only; contracts, not implementations. Reuses the existing delivery seam
> (`@partnera/http-api` `Router` + `buildApiRouter`) and `EventBus`. Transport-agnostic;
> NestJS/Next is the eventual host (D-210). All routes are permission-gated and
> tenant-scoped from context.

## 1. Contract conventions

- **Auth**: principal + tenant from the verified session (never request body).
- **Idempotency**: money/submission-mutating calls take an `Idempotency-Key`.
- **Errors**: `DomainError → HTTP status` mapping (existing).
- **Pagination**: cursor-based (existing `@partnera/core`).
- **Versioning**: contracts versioned; opportunity/requirement specs are version-pinned.

## 2. API surfaces (logical resources → operations)

| Surface | Key operations |
|---|---|
| **Company discovery** | `GET /discovery/companies`, `GET /discovery/opportunities` (filters: format, platform, budget, rights, deadline, eligibility) |
| **Creator profiles** | `GET/POST/PATCH /creators/me`, `…/portfolio`, `…/skills`; `GET /creators/{id}` (scoped) |
| **Programs / pages** | `GET/POST/PATCH /programs`, `…/page` (draft/preview/publish) |
| **Campaigns** | `GET/POST/PATCH /campaigns` |
| **Opportunities** | `GET/POST/PATCH /opportunities`, `POST …/publish|pause|close` |
| **Applications** | `POST /opportunities/{id}/apply`, `POST …/invite`, `POST /applications/{id}/accept` (locks fee snapshot) |
| **Submissions** | `POST /jobs/{id}/submissions`, `POST …/versions`, `GET …` |
| **Review** | `POST /submissions/{id}/review`, `…/approve|reject|request-revision`, `POST …/override` |
| **AI review** | `POST /submissions/{id}/ai-review` (advisory), `GET …/ai-runs` |
| **Disputes** | `POST /disputes`, `POST /disputes/{id}/evidence|resolve` |
| **Content library** | `GET/POST/PATCH /assets`, `…/license`, `POST …/publish|restrict|withdraw` |
| **Rank unlocks** | `GET/POST/PATCH /rank-unlocks` |
| **Payments / fees** | `POST /payables/{id}/authorize`, `POST …/execute`, `GET …/receipt`, `GET /fee-config` |
| **Reputation / ratings** | `GET /creators/{id}/reputation`, `POST /jobs/{id}/rate-business` |
| **Moderation** | `GET/POST /moderation/cases` (operator) |
| **Analytics** | `GET /analytics/{scope}` (platform/business/creator/affiliate) |

Each maps to an application-layer service method behind a permission check; the HTTP router
is a thin adapter.

## 3. Domain events (append-only, on the existing `EventBus`)

```
creator.profile_created            submission.uploaded
creator.joined_business            submission.review_started
opportunity.published              submission.revision_requested
opportunity.paused|closed          submission.approved
application.submitted              submission.rejected
application.invited|accepted       aireview.completed
payment.authorized                 dispute.opened
payment.processing                 dispute.resolved
payment.paid                       content.published_to_library
payment.failed|reversed            affiliate.content_unlocked
platform_fee.recognized            license.expired
platform_fee.reversed              rank_unlock.changed
```

Money events (`payment.*`, `platform_fee.*`) are also **ledger appends**, not just
notifications — the event stream and the ledger are consistent by construction.

## 4. Event envelope (every event)

```
{ id, type, version,
  actor: { userId | serviceId, role },
  tenant: businessId | null,        // null for cross-tenant/creator-actor events
  subject: { entity, id },
  correlationId, causationId,       // trace a whole flow / cause chain
  occurredAt,                       // from injected Clock
  idempotencyKey?,                  // money-affecting events
  payload: { … } }
```

## 5. Delivery guarantees

- **Idempotency / at-most-once** on money-affecting events (D-010): duplicate delivery is a
  no-op via the idempotency key.
- **Retry** with backoff → dead-letter for consumers (reuses notification-engine discipline).
- **Ordering** per subject via sequence; consumers must tolerate out-of-order across
  subjects.
- **Audit**: every event is retained; `correlationId`/`causationId` reconstruct any flow.
- **Eventing tech** (durable queue) is the existing open decision (D-103); the logical
  contract is defined here.

## 6. Webhooks (business-facing)

Businesses may subscribe (per plan/entitlement) to a filtered event feed for their tenant
(e.g. `submission.approved`, `payment.paid`). Webhook subscriptions are a **standing
configuration** — created only with explicit business action, signed, and audited.
