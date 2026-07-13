# Tenant Migration — Local Pilot → Hosted PrimeBuild

> **Part 6.** Idempotent import of the existing local PrimeBuild pilot config into the hosted
> tenant created at install, **without duplicating** programs/schemes and **preserving**
> PrimeBuild's editable $0/$10/$20/$35, 10-video target, fee, budget, and capacity.

## Principle
The install path (`InstallationService.installOrResolve`) creates a **generic** tenant (org →
business → owner → onboarding → storage) — **no PrimeBuild-specific globals**. PrimeBuild's config
is then imported as **that tenant's data**, exactly as any merchant would configure it.

## Source of truth
The local pilot's configuration is already fully persisted (Day 1.13): `evaluation_schemes`,
`program_capacities`, `program_budgets`, `program_fee_settings`, `pilot_checklists`, opportunities,
etc. Migration reads these (or a serialized export) and re-applies them through the **services**
(`saveScheme`, `setBudget`, `setCapacity`, `setFeeRate`) so all invariants/validation run.

## Idempotent import steps
1. Resolve the hosted PrimeBuild tenant from the verified shop (`resolveTenant`).
2. If a program with slug `creators` exists → **update** it; else create one (no duplicates;
   `evaluation_schemes` has a unique index per program).
3. Apply the scheme (Rejected $0 / Acceptable $10 / Good $20 / Excellent $35 — **editable**),
   capacity (maxAccepted target 10), budget, and fee (3%). Re-running is a no-op/update.
4. Recreate the demo opportunities + one safe test creator + one safe test affiliate
   (synthetic/demo content metadata only).
5. Run the integrity check (`integrityCheck`) — expect 0 issues (no duplicate programs/schemes,
   fee in range, no cross-tenant records).

## Safety
- No cross-business records; scoped to the resolved tenant.
- No destructive deletes; existing records are updated, not replaced blindly.
- `$0/$10/$20/$35` is **PrimeBuild data**, never a Partnera global default.
- Verified locally by the snapshot round-trip + integrity tests; the hosted run repeats the same
  service calls against the Prisma-backed store (🔒 needs the hosted DB).
