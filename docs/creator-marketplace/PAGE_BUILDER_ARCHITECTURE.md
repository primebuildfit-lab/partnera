# Page Builder Architecture — Creator Marketplace

> **Part 3 (builder half).** A configurable, block-based page-builder so every business can
> create its own branded public pages. Config-over-code (D-003/D-303): a page is a **data
> document** of blocks, rendered by adapters across channels
> ([STOREFRONT_SURFACES.md](STOREFRONT_SURFACES.md)). **Shopify is one channel, not the
> core** (D-314).

## 1. What businesses can build

- Affiliate Program page · Creator Program page · Opportunity directory · Job/opportunity
  detail page · Content library (affiliate-facing) · Creator onboarding page · Submission
  instructions · Terms & disclosures · FAQ · Reward & payment explanation.

## 2. Model

A **Page** is a versioned document:

```
Page {
  id, businessId, kind,            // creator_program | affiliate_program | opportunity_dir | ...
  slug, status,                    // draft | preview | published
  theme: { logo, colors, typography, spacing },
  blocks: Block[],                 // ordered
  visibility: { audience, gates }, // public | enrolled | rank | invite
  seo, legal, version, updatedAt
}
```

**Blocks** (composable, typed, data-driven):
hero · image · video · text section · card grid · FAQ · requirements · payment display ·
campaign block · opportunity listing · rank table · content categories · testimonials ·
call-to-action · application form · legal disclosure. Businesses can enable/disable and
reorder blocks; advanced blocks are entitlement-gated ([ENTITLEMENTS.md](ENTITLEMENTS.md)).

Each block has a **typed schema** (its fields) and binds to **live domain data** where
relevant (e.g. an `opportunity listing` block queries the business's open opportunities; a
`rank table` block reflects real rank unlocks). Blocks never contain executable code
(preserves the no-arbitrary-code invariant, D-008).

## 3. Theming

`logo`, `colors` (brand palette, light/dark), `typography`, `spacing` — a theme token set
per business, mirroring the existing `@partnera/ui` token approach so channels render
consistently. Custom branding/domains are entitlement-gated.

## 4. States: draft / preview / published

- **Draft** — editable, not public.
- **Preview** — shareable private preview (signed link) for review.
- **Published** — public per `visibility`. Publishing is versioned; rollback is possible.

Publishing a public page is an **outward-facing action**: it requires explicit business
action and appropriate permission (`creator_page.manage`), and is audited.

## 5. Rendering pipeline (channel-agnostic)

```
Page document (blocks + theme + data bindings)
        │
        ▼
Renderer core (resolves data bindings via QueryService, applies theme)
        │
   ┌────┴───────────────┬───────────────┬──────────────────┐
   ▼                    ▼               ▼                  ▼
Partnera hosted page  Shopify app     Shopify app blocks  Storefront widgets
(SSR, @partnera/web)  (embedded)      (theme sections)    (embeddable)
```

The renderer core is the single source of truth; each channel is a **presentation adapter**
([STOREFRONT_SURFACES.md](STOREFRONT_SURFACES.md)). Data bindings resolve through the
permission-gated `QueryService` so a page never leaks data the viewer shouldn't see (drafts,
locked assets, cross-tenant).

## 6. Access & safety

- Public pages expose only **published, permitted** data; affiliate-facing library blocks
  respect rank + license ([CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md)).
- Application-form blocks submit to the application layer with anti-abuse (rate-limit,
  validation); forms reached from untrusted embeds are treated with the platform's standard
  form-safety rules.
- Legal-disclosure blocks (FTC/sponsored/affiliate) are first-class so businesses can meet
  disclosure obligations ([LEGAL_REVIEW.md](LEGAL_REVIEW.md)).

## 7. Reuse

Reuses `@partnera/ui` tokens/components and the `@partnera/platform` config/flags. The page
document sits in persistence behind the existing repository seam. No new rendering framework
is introduced beyond the existing SSR approach (D-215).
