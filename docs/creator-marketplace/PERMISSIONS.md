# Permissions — Creator Marketplace

> **Part 12 (permissions half).** Permission matrices for every actor. Reuses Partnera's
> **data-driven RBAC** (`@partnera/auth`): a permission catalog + role templates + custom
> roles + deny-by-default `PermissionEngine`. Isolation rules are in
> [SECURITY_MODEL.md](SECURITY_MODEL.md). **No hardcoded role checks** (D-205).

## 1. New permission catalog keys (proposed)

Grouped like the existing catalog (`resource.action`); wildcards (`creator.*`, `content.*`,
`*`) supported by the existing engine.

```
creator_program.manage        content_opportunity.publish     submission.review
creator_program.view          content_opportunity.manage      submission.approve
creator_page.manage           content_campaign.manage         submission.reject
creator.invite                application.manage              submission.request_revision
creator.view                  deliverable.define              review.override
content_asset.manage          content_license.manage          payment.authorize
content_asset.view            rank_unlock.manage              payment.execute
affiliate_content.view        moderation.handle               dispute.handle
fee_config.manage (platform)  analytics.creator.view          audit.view
```

Money keys deliberately split `payment.authorize` (approve to pay) from `payment.execute`
(release payout) to support separation of duties (D-317).

## 2. Role → capability matrix (templates; tenants add custom roles)

Legend: ✓ full · ▲ bounded (limits/value-cap) · R read-only · — none.

| Capability | Platform Admin | Platform Moderator | Business Owner | Business Admin | Campaign Mgr | Reviewer | Finance Approver | Employee | Contractor | Creator | Affiliate | AI Review Svc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| creator_program.manage | ✓* | — | ✓ | ✓ | ▲ | — | — | — | — | — | — | — |
| creator_page.manage | ✓* | — | ✓ | ✓ | ▲ | — | — | — | — | — | — | — |
| content_opportunity.publish/manage | ✓* | — | ✓ | ✓ | ✓ | — | — | ▲ | ▲ | — | — | — |
| application.manage / creator.invite | ✓* | — | ✓ | ✓ | ✓ | — | — | ▲ | ▲ | — | — | — |
| submission.review | ✓* | ▲ | ✓ | ✓ | ✓ | ✓ | — | ▲ | ▲ | — | — | ▲(advisory) |
| submission.approve/reject/request_revision | ✓* | — | ✓ | ✓ | ▲ | ▲ | — | ▲ | ▲ | — | — | — |
| review.override | ✓* | ▲ | ✓ | ✓ | ▲ | ▲ | — | — | — | — | — | — |
| payment.authorize | ✓* | — | ✓ | ▲ | — | — | ✓ | — | — | — | — | — |
| payment.execute | ✓* | — | ✓ | ▲ | — | — | ▲ | — | — | — | — | — |
| content_asset.manage / rank_unlock.manage | ✓* | — | ✓ | ✓ | ▲ | — | — | ▲ | — | — | — | — |
| affiliate_content.view | ✓* | — | R | R | R | — | — | — | — | — | ✓(by rank) | — |
| dispute.handle / moderation.handle | ✓ | ✓ | ▲(own) | ▲(own) | — | — | — | — | — | — | — | — |
| fee_config.manage | ✓ | — | ▲(within range) | ▲ | — | — | — | — | — | — | — | — |
| creator self-profile/portfolio | — | R(audited) | — | — | — | — | — | — | — | ✓ | — | — |
| submit / revise (own jobs) | — | — | — | — | — | — | — | — | — | ✓ | — | — |
| analytics (scope) | ✓(platform) | R | ✓(own) | ✓(own) | ▲ | R | R | ▲ | ▲ | ✓(own) | ✓(own) | — |
| audit.view | ✓ | ✓ | ▲(own) | ▲(own) | — | — | — | — | — | — | — | — |

`✓*` = cross-tenant only via **audited operator path**, never silent.

## 3. Separation-of-duties rules (enforced)

- A user cannot `submission.approve` **and** `payment.authorize` **and** `payment.execute`
  on the same payable where SoD is configured (default recommended on money paths, D-053).
- A user cannot review/approve their **own** submission.
- Multi-reviewer approval requires N distinct principals.
- Contractor/employee approval is **bounded** by a value cap; above it, escalates.

## 4. Delegation & limits

Custom roles compose catalog keys with **scope** (which programs/campaigns) and **limits**
(value caps, approve-vs-recommend). Delegation is explicit and audited; a delegate can never
exceed the delegator's own grants (no privilege escalation).

## 5. Enforcement point

All checks run in the **application layer** (`policy.require(context, key, scope)`),
deny-by-default, before any repository access — exactly as existing services do. The UI
gates navigation/controls too, but the application layer is the source of truth. See
[SECURITY_MODEL.md](SECURITY_MODEL.md).
