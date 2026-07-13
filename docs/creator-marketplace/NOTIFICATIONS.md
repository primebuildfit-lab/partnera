# Notifications — Creator Marketplace

> **Part 16.** Notification design. Reuses `@partnera/notification-engine` (channels,
> template render, preference gating, backoff → dead-letter). Adds creator-marketplace event
> types; no new engine.

## 1. Notifiable events (by audience)

| Event | Creator | Business | Affiliate | Admin |
|---|---|---|---|---|
| new opportunity (match) | ✓ | — | — | — |
| invitation | ✓ | — | — | — |
| application accepted / rejected | ✓ | ✓ | — | — |
| submission received | — | ✓ | — | — |
| review started | ✓ | ✓ | — | — |
| revision requested | ✓ | ✓ | — | — |
| approval | ✓ | ✓ | — | — |
| rejection | ✓ | ✓ | — | — |
| dispute opened / resolved | ✓ | ✓ | — | ✓ |
| payment authorized | ✓ | ✓ | — | — |
| payment paid | ✓ | ✓ | — | — |
| payout failed | ✓ | ✓ | — | ✓ |
| content unlocked (new asset for rank) | — | — | ✓ | — |
| license expiring / expired | ✓(author) | ✓ | ✓ | — |
| campaign closing | ✓ | ✓ | ✓ | — |
| rank changed | — | — | ✓ | — |
| moderation / fraud action | ✓/✓ | ✓ | ✓ | ✓ |

## 2. Channels

- **in-app** (now, design target), **email** (later), **push** (later), **webhook**
  (business-facing, [API_AND_EVENTS.md](API_AND_EVENTS.md#6-webhooks-business-facing)),
  **business-configured channels** (e.g. Slack) later.

## 3. Controls (reuse engine capabilities)

- **Preferences**: per-category, per-channel opt-in/out (earning/critical categories may be
  non-optional, e.g. payment/dispute/legal).
- **Quiet hours**: per user; critical notices override.
- **Dedupe**: collapse repeated events (e.g. multiple asset unlocks → one digest).
- **Retry**: backoff → dead-letter on delivery failure.
- **Audit**: notification sends are recorded.
- **Critical vs. optional**: money, disputes, moderation, and legal notices are **critical**
  (always delivered, higher priority); marketing/discovery nudges are **optional**.

## 4. Templates & localization

Templates are data (per event type + channel + language), rendered by the engine; language
follows the recipient's preference. Business-branded templates are entitlement-gated.

## 5. Safety

- Notifications never leak scope-restricted data (e.g. a creator's notice never reveals other
  creators' work; an affiliate's unlock notice respects rank/license).
- Outbound messages to a user are the existing engine's job; sending on a user's behalf to
  third parties is not part of this module.
