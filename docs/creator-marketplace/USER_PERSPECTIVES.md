# User Roles & Perspectives — Creator Marketplace

> **Part 2.** The module designed from every required perspective. Documentation-only.
> Capabilities here are gated by the permission matrices in [PERMISSIONS.md](PERMISSIONS.md)
> and isolated per [SECURITY_MODEL.md](SECURITY_MODEL.md). Every action is tenant-scoped
> from the authenticated context, never from client input.

The platform serves five perspectives. A single **User** may hold several of these at
once (e.g. affiliate + creator, or business staff in one tenant and creator in another).
Identity is global; capability is per-membership and per-relationship.

---

## A. Partnera Platform Admin (operator)

Partnera's own operators. Cross-tenant, but only via **audited operator paths** — never
silent access. Manages the network, not any one business's private creative choices.

Can manage: businesses; creators; affiliates; workers; creator programs; content
campaigns; opportunities; jobs; submissions; reviews; AI evaluation configuration and
runs; payments; platform-fee configuration (global range + guardrails); disputes; fraud
signals/cases; moderation queues; restricted businesses; restricted creators; global
rules and defaults; plan entitlements; platform statistics; audits; system health.

Cannot: silently read a business's private submissions or a creator's private source
files without an audited moderation/dispute/legal basis; alter an accepted fee snapshot
on an in-flight job; edit money records (append compensating events only).

Surfaces: **Admin Console** (extended). See [UX_SPECIFICATIONS.md](UX_SPECIFICATIONS.md#platform-admin).

---

## B. Business Owner (tenant)

The tenant that runs a content program. Full authority **within its own tenant only**.

Can: create a Creator Program; customize its public page (branding, logo, colours,
typography, hero, media, sections — [PAGE_BUILDER_ARCHITECTURE.md](PAGE_BUILDER_ARCHITECTURE.md));
define eligible creators (open / invite-only / private pool / rank/reputation gates);
publish opportunities; define deliverables and requirements; set budgets and payment per
video/asset; define review criteria and scoring weights; review submissions personally;
authorize AI-assisted review and choose the approval mode; request revisions; approve or
reject; release payments (subject to separation-of-duties config); organize approved
content into the library; assign content to affiliate ranks (rank unlocks); control who
can download/use each asset; view creator performance; view affiliate use of content;
manage permissions for business staff.

Cannot: access another business's data; access a creator's private/unsubmitted source
material; change the platform-fee range outside global guardrails; retroactively change a
fee snapshot on an accepted job; mutate the ledger.

Surfaces: **Business Dashboard** (extended with a Creator section).

---

## C. Creator

Can: create a profile (skills, content formats, supported platforms); upload a portfolio;
discover participating companies; filter opportunities (format, platform, budget, rights,
deadline, eligibility); select a company; accept terms (with the **fee and net amount
shown in full first**); create and upload content; assign each submission to the correct
business + campaign + opportunity; receive review results (scores, flags, explanations);
submit revisions; view approved payments and fees; view reputation and history; manage
payout details **later via an external payment provider** (Partnera never stores cards).

Cannot: see other creators' private submissions; see a business's internal-only files;
access affiliate libraries or other businesses' data; be forced onto a paid plan to earn.

Surfaces: **Creator Portal** (new). See [UX_SPECIFICATIONS.md](UX_SPECIFICATIONS.md#creator).

---

## D. Affiliate

The existing affiliate, extended to consume approved content. **All existing affiliate
commission functionality is retained unchanged.**

Can: view approved content libraries for businesses they're enrolled with; see which
assets are unlocked at their current rank and which are locked (with the rank required);
download/use approved, rank-unlocked assets; use tracked campaign assets; see usage rules,
permitted platforms, and expiration dates; continue earning normal sales commissions.

Cannot: access drafts, rejected content, expired licenses, assets above their rank,
internal-only files, creator-private source material, or any other business's content.

Surfaces: **Affiliate Portal** (extended with a Content Library section).

---

## E. Business Staff / Contractor (delegated)

Support employees, contractors, or delegated reviewers acting for a business within
configured limits.

Can: manage campaigns; review and moderate submissions; organize assets; approve within
configured limits (e.g. up to a value cap, or recommend-only); never access unrelated
company data; act only on the campaigns/programs they're assigned to.

Cannot: exceed their delegated approval/payment limits; approve **and** execute payment
where separation-of-duties is required; access other tenants; access data outside their
assignment scope.

Surfaces: **Business Dashboard** (permission-scoped subset).

---

## Cross-role rules

- **Dual creator/affiliate:** one identity, two capability sets, resolved per membership
  and per business relationship. A creator who is also an affiliate sees the Creator
  Portal and the Affiliate Portal; access in each is independent.
- **Conflict of interest:** a user cannot review or approve their **own** submission; a
  business cannot rate a creator on a job it never engaged; reviewers with a relationship
  to a submission are recused ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md#reviewer-conflicts)).
- **AI review service** is a constrained service principal with access to **only** the
  exact submission under review — nothing else ([SECURITY_MODEL.md](SECURITY_MODEL.md#ai-review-service)).
- **Least privilege everywhere:** deny-by-default; capability comes from role templates +
  custom roles (data-driven RBAC, reusing `@partnera/auth`).
