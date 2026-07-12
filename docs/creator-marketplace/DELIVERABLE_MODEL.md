# Deliverable Model — Creator Marketplace

> **Part 5.** Configurable content types and the requirement schema every deliverable
> supports. Documentation-only. Config-over-code (D-003): deliverable types and their
> constraints are **data** interpreted by engines, not hardcoded per format.

## 1. Deliverable types (starter catalog, extensible)

Types are catalog entries, not enum branches. Businesses may enable, disable, or define
custom types.

| Type key | Description |
|---|---|
| `short_form_video` | Short vertical/social video (Reels/TikTok/Shorts style). |
| `long_form_video` | Long-form video (YouTube-style). |
| `ugc_video` | User-generated-content style video (authentic, creator-shot). |
| `product_demo` | Product demonstration video. |
| `testimonial` | Testimonial video or written. |
| `tutorial` | How-to / tutorial. |
| `unboxing` | Unboxing video. |
| `product_photography` | Product still photography. |
| `lifestyle_photography` | Lifestyle/in-context photography. |
| `carousel` | Multi-image carousel/set. |
| `banner` | Static banner/creative. |
| `voiceover` | Voiceover audio. |
| `blog_article` | Written article. |
| `script` | Script/copy for video. |
| `caption` | Social caption/copy. |
| `livestream` | Live stream appearance/session. |
| `raw_footage` | Unedited source footage. |
| `edited_footage` | Edited footage. |
| `reusable_template` | Reusable creative template. |
| `custom` | Business-defined format (name + schema supplied by the business). |

## 2. Deliverable Requirement schema

Every **Deliverable Requirement** (one required output within an opportunity) supports the
following configurable fields. All are optional unless the type/business marks them
required; unset means "not constrained".

### Technical spec
- `dimensions` (e.g. 1080×1920), `orientation` (portrait/landscape/square)
- `duration` (min/max seconds), `frame_rate`, `resolution_min`
- `file_type(s)` (allow-list), `file_size_limit`, `codec/format` constraints
- `platform` target(s) (Instagram/TikTok/YouTube/…); `language`(s)

### Creative brief
- `required_talking_points` (list), `key_messages`, `tone`, `hook_requirements`
- `prohibited_claims` (list — e.g. medical/health/earnings claims), `prohibited_content`
- `product_requirements` (which product(s), how shown, on-screen time)
- `brand_guidelines` (logo usage, colours, do/don't), `call_to_action` requirement
- `music_license_requirements` (licensed-only / provided track / no music)

### Commercial & rights
- `payment` (amount, currency), `bonus` (condition → amount)
- `usage_rights` (owned channels / paid ads / affiliate distribution / organic only)
- `exclusivity` (none / category / full), `geographic_rights`, `license_duration`
- `whitelisting` (may the business run ads from the creator's handle?) — flag + terms

### Process
- `deadline`, `revision_allowance` (default per D-333), `submission_instructions`
- `review_criteria` reference (scoring template — [REVIEW_AND_SCORING.md](REVIEW_AND_SCORING.md))
- `mandatory_checks` (safety/legal that must pass regardless of score)

## 3. Opportunity ↔ deliverable relationship

- An **Opportunity** contains one or more **Deliverable Requirements**.
- A **Submission** targets one or more requirements; each satisfied requirement is a
  **payable unit** (supports partial approval and milestones — see
  [STATE_MACHINES.md](STATE_MACHINES.md#4-payment-per-payable-deliverablemilestone)).
- **Budget** is enforced at campaign and opportunity level; a payment that would exceed
  remaining budget is blocked at authorization.

## 4. Validation & determinism

- Technical checks (dimensions/duration/type/size) are **objective** and machine-checkable
  — candidates for AI/automated pass ([AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md)).
- `prohibited_claims`, rights, and safety are **mandatory-pass** gates: failing any is an
  automatic non-approval regardless of creative score.
- Requirement definitions are **versioned** with the opportunity so a submission is always
  reviewed against the exact spec that was live when the creator accepted terms
  (explainability, inherited from D-009).

## 5. Rights vocabulary (shared)

`usage_rights`, `exclusivity`, `geographic_rights`, and `license_duration` here are the
same fields that flow into the **Content License** on approval
([CONTENT_LIBRARY.md](CONTENT_LIBRARY.md)) and constrain affiliate use downstream. Final
default values are counsel-gated (OQ-20, [LEGAL_REVIEW.md](LEGAL_REVIEW.md)).
