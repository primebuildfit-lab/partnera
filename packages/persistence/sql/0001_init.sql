-- Partnera — append-only & integrity enforcement (PostgreSQL).
--
-- Companion to prisma/schema.prisma. Prisma creates the tables, columns, unique
-- constraints, and indexes; this migration adds the guarantees Prisma cannot
-- express but the money invariants require:
--
--   1. UPDATE/DELETE-blocking triggers on every append-only table, so the
--      ledger, payout stream, audit log, and touch/refund streams are immutable
--      at the database boundary — not merely by application convention.
--   2. A CHECK that ledger amounts are stored as exact integer minor units.
--   3. Guidance for physical tenant isolation (D-102b) via Row-Level Security.
--
-- Run AFTER `prisma migrate deploy`. Idempotent: safe to re-run.

-- 1. Append-only enforcement -------------------------------------------------

CREATE OR REPLACE FUNCTION partnera_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  append_only_tables text[] := ARRAY[
    'ledger_events',
    'payout_events',
    'audit_log',
    'clicks',
    'coupon_uses',
    'refunds',
    'fraud_signals',
    'fraud_scores',
    'offer_versions',
    'idempotency_keys'
  ];
BEGIN
  FOREACH t IN ARRAY append_only_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_append_only_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I '
      || 'FOR EACH ROW EXECUTE FUNCTION partnera_block_mutation()',
      'trg_append_only_' || t, t
    );
  END LOOP;
END;
$$;

-- 2. Money integrity ---------------------------------------------------------
-- amount_minor is BIGINT (exact integer minor units) — floats are impossible by
-- column type. This CHECK additionally forbids a currency without an amount on
-- commission.created rows (belt-and-braces for the money spine).

ALTER TABLE ledger_events
  DROP CONSTRAINT IF EXISTS ledger_created_has_amount;
ALTER TABLE ledger_events
  ADD CONSTRAINT ledger_created_has_amount
  CHECK (type <> 'commission.created' OR (amount_minor IS NOT NULL AND amount_currency IS NOT NULL));

-- 3. Physical tenant isolation (D-102b) --------------------------------------
-- The logical isolation invariant is enforced in the repositories (every query
-- is scoped to the RequestContext tenant). For defense-in-depth in a shared
-- schema, enable Row-Level Security and set `app.tenant_id` per connection. The
-- decision between shared-schema RLS and schema-per-tenant is D-102b; the
-- template below is the shared-schema option.
--
--   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation ON orders
--     USING (tenant_id = current_setting('app.tenant_id', true));
--   -- ...repeat for every tenant-scoped table...
--
-- Left commented so it is an explicit, reviewed deploy decision rather than a
-- silent default.
