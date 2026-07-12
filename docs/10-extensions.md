# 10 — Extension Ecosystem

> Partnera should grow capabilities faster than we can build them, by letting businesses and developers **contribute** — safely. The absolute rule: **never allow arbitrary code execution in our runtime.**

## What can be contributed

- **Offer templates** — pre-built compositions of offer blocks.
- **Affiliate templates** — recruitment/onboarding/tier setups.
- **Tracking modules** — new attribution helpers (declarative, within engine contracts).
- **Reporting modules** — report/dashboard definitions.
- **Marketing tools** — creatives, sequences, widgets.
- **Automation modules** — declarative "when X, do Y" workflows over allowed actions.
- **Widgets** — embeddable UI components rendered in a sandbox.
- **Integrations** — adapters to external platforms (reviewed, capability-scoped).
- **Analytics modules** — metric/visualization definitions.

## Security model (the core constraint)

Extensions are **declarative and sandboxed**, never trusted code in the core:

1. **Declarative-first.** Most extensions are **configuration/data** (offer templates, report defs, automation rules over an allow-listed action set). Data cannot execute.
2. **Manifest contract.** Every extension ships a manifest declaring its type, the **hooks** it uses, the **capabilities/scopes** it needs, and its inputs/outputs. The Extension Engine only ever invokes declared hooks and only grants declared scopes.
3. **No core code execution.** Extensions never run inside Partnera's core process with core data access.
4. **Sandboxed execution (only if ever needed).** If any extension type genuinely needs logic, it runs in an **isolated sandbox** (separate, constrained runtime) with:
   - no ambient access to core data,
   - only the data explicitly passed per its scope,
   - resource/time limits,
   - outputs treated as **data**, validated before use.
5. **Least privilege.** Scopes are minimal and explicit; a reporting module can't touch payouts.
6. **Untrusted output validation.** Anything an extension returns is validated/sanitized before it influences money, UI, or data.
7. **Widgets are sandboxed UI** (isolated frame, constrained messaging), never given the parent app's privileges.

> Default posture: **prefer templates and declarative configuration; treat executable extensions as the rare, heavily-sandboxed exception.**

## Approval workflow (every submission reviewed)

```
Contributor submits extension + manifest
        ▼
Automated checks (schema valid, scopes sane, no disallowed capabilities, static safety)
        ▼
Human review (functionality, security, quality, policy, IP)
        ├─ rejected ─► feedback to contributor
        └─ approved ─► published to Marketplace, versioned
        ▼
Tenants install; installs are scoped & revocable; versions are tracked
```

- Reviews and decisions are **audited** (ApprovalRecord).
- Approved items are **versioned**; updates re-enter review.
- Deprecation/removal path exists (security revocation can force-disable an installed extension across tenants).

## Contributor commercial model

- Approved content **may be reused by Partnera for future customers** per the published policy.
- Contributors receive a **predefined commission** when their content is adopted/monetized (runs through the same auditable ledger — see [06-commission-engine.md](06-commission-engine.md)).
- **Partnera retains commercial rights** according to the published contributor policy/agreement (accepted at submission).
- Contributor identity, agreement acceptance, and payout terms are recorded.

## Trust & safety controls

- Reputation/quality signals per contributor and per extension.
- Report/flag path for tenants; moderation queue in Admin Console.
- Kill-switch: platform can disable a listing/extension network-wide on security grounds.
- Clear data-access disclosure to installing tenants (what scopes an extension gets).

## Interfaces

- **Extension Engine** — registry, manifest validation, sandboxing, hook invocation.
- **Marketplace Engine** — listing, discovery, install, contributor commissions ([11-marketplace.md](11-marketplace.md)).
- **Admin Console** — approvals, moderation, kill-switch, contributor payouts.
- **All engines** — expose *declared, allow-listed* hooks/actions only.

## Invariants

1. **No arbitrary code execution** in the core — ever.
2. **Least-privilege, declared scopes**; nothing ambient.
3. **Every submission reviewed & audited** before publish.
4. **Outputs are untrusted data** until validated.
5. **Platform can revoke** any extension network-wide.
6. **Contributor rights & commissions** are governed by the published policy and recorded.

## Open decisions (see DECISIONS.md)
- Which extension types are declarative-only vs. sandbox-executable.
- Sandbox technology (deferred to build phase).
- Contributor commission rates & rights policy specifics.
- Whether third-party integrations are contributor-built or platform-only at launch.
