# Open Questions — Creator Marketplace

> **Part 21 (open half).** Genuinely undecided items that must be resolved before or
> during the relevant build phase. Deciding them now would either violate the
> design-only constraint or lacks information (pricing, counsel, pilot data). Locked
> decisions are in [DECISIONS.md](DECISIONS.md).

Legend: **Owner** = who must decide · **Blocks** = which CM phase it gates
(see [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)).

## Money & fees

| # | Open question | Owner | Blocks | Notes |
|---|---|---|---|---|
| OQ-01 | **Exact default fee** within 2–4% (provisional 3%) | Business | CM10 | Trades revenue vs. adoption. |
| OQ-02 | **Who ultimately pays the fee** — business, creator, split | Business/Legal | CM10 | Default business-paid (D-311); creator-net must always be transparent. |
| OQ-03 | **Funding model** — pre-funded escrow-like hold vs. charge-on-approval vs. invoice | Business/Legal | CM10 | Interacts with non-custodial stance (D-050/D-106). |
| OQ-04 | **Payout timing** — on approval, net-N days, scheduled batch | Business | CM10 | Affects disputes and float. |
| OQ-05 | **Reduced-fee plan rules** — floor, eligibility, enterprise-negotiated | Business | CM10/plans | Must stay within global range. |
| OQ-06 | **Reimbursement/bonus fee treatment** — fee-exempt vs. configurable | Business/Legal | CM10 | Provisional: reimbursements fee-exempt. |
| OQ-07 | **Currency & FX** — settlement currency, who bears FX | Build | CM10 | Reuses explicit-currency invariant (D-112 upstream). |

## Review, quality & AI

| # | Open question | Owner | Blocks | Notes |
|---|---|---|---|---|
| OQ-10 | **AI auto-approval limits** — which objective checks, value ceiling, off-by-default confirmed | Product/Legal | CM9 | D-307/D-336 constrain; exact list open. |
| OQ-11 | **Review time limits** — SLA per plan; consequences of breach | Business | CM8 | Provisional 5 business days. |
| OQ-12 | **Scoring weights defaults** — starting weights + mandatory-fail set | Product | CM8 | See [REVIEW_AND_SCORING.md](REVIEW_AND_SCORING.md). |
| OQ-13 | **Creator reputation formula** — inputs, decay, cross-business portability | Product | CM4/CM6 | Must be explainable; anti-gaming. |
| OQ-14 | **AI provider(s)** for review + disclosure obligations | Build/Legal | CM9 | Provider-independent seam; none chosen. |

## Rights, safety & compliance

| # | Open question | Owner | Blocks | Notes |
|---|---|---|---|---|
| OQ-20 | **Ownership/license defaults** — exclusivity, geography, duration, moral rights | Legal | CM7 | Provisional D-335; counsel required. |
| OQ-21 | **Minimum creator age** + minors handling | Legal | CM4 | Provisional 18. |
| OQ-22 | **KYC/KYB thresholds** — when identity/business verification triggers | Legal | CM10/CM14 | Ties to provider + sanctions. |
| OQ-23 | **Supported countries** at pilot and launch | Legal/Business | CM14/CM15 | Scopes sanctions, tax, payout rails. |
| OQ-24 | **Contractor classification** stance per jurisdiction | Legal | CM15 | Platform must not misclassify; see [LEGAL_REVIEW.md](LEGAL_REVIEW.md). |
| OQ-25 | **Music/third-party rights** verification depth | Legal | CM8 | Prohibited-claim + rights checks. |
| OQ-26 | **Automated-decision appeal** rights (GDPR Art. 22-style) | Legal | CM9 | Appeal path already designed; legal scope open. |

## Content, storage & attribution

| # | Open question | Owner | Blocks | Notes |
|---|---|---|---|---|
| OQ-30 | **Supported content storage/CDN** provider | Build | CM7 | Seam defined (D-319); provider open. |
| OQ-31 | **File-size / duration limits** per plan and format | Product | CM5/CM7 | Unbounded storage is a named risk. |
| OQ-32 | **Content-attribution method** — how affiliate use of an asset ties to sales | Product | CM7/CM15 | Reuses tracking spine; mapping open. |
| OQ-33 | **Retention** of raw source vs. approved assets vs. rejected | Legal/Build | CM7 | Interacts with disputes + privacy. |

## Marketplace shape

| # | Open question | Owner | Blocks | Notes |
|---|---|---|---|---|
| OQ-40 | **Affiliate rank model** — reuse existing tiers vs. content-specific ranks | Product | CM7 | Prefer reuse; confirm tier source. |
| OQ-41 | **Business plan structure** for creator features | Business | CM/plans | Entitlement matrix drafted ([ENTITLEMENTS.md](ENTITLEMENTS.md)); prices open. |
| OQ-42 | **Invite vs. open vs. private-pool** defaults per program | Business | CM5 | Business choice; platform default open. |
| OQ-43 | **Two-sided cold-start** strategy (seed creators/opportunities) | Business | CM15/CM16 | Pilot with PrimeBuild first. |

## Naming / integration

| # | Open question | Owner | Blocks | Notes |
|---|---|---|---|---|
| OQ-50 | Final **module/phase numbering** vs. existing MM5 | Product | CM0 | This doc uses CM0–CM16; MM5 stays "Live Infrastructure". |
| OQ-51 | Whether Creator Marketplace ships **before or after** affiliate-core is live | Product | — | Recommended: after Phase 1 exit (live infra). |
