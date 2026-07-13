-- Partnera — migration 0002: Creator Marketplace + Shopify tables.
--
-- Companion to prisma/schema.prisma (models added in the Activation phase).
-- Each aggregate is an indexed JSONB row: key/tenant/unique columns are real
-- indexed columns; the full value object lives in `data JSONB`. Money stays
-- exact (minorUnits as text inside JSONB — never float); `version` backs
-- optimistic concurrency; append-only tables get UPDATE/DELETE-blocking
-- triggers (same discipline as 0001_init.sql).
--
-- NOTE: This is a delivery artifact. It is NOT executed by the TypeScript build.
-- Running it requires a provisioned Postgres + authorization (external gate).

-- Reuse the append-only guard function from 0001_init.sql if present; define if not.
CREATE OR REPLACE FUNCTION partnera_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %: UPDATE/DELETE not allowed', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ---- Creator Marketplace (mutable aggregates) ----
CREATE TABLE creator_profiles          (id TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE creator_relationships     (creator_id TEXT NOT NULL, business_id TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (creator_id, business_id));
CREATE TABLE creator_programs          (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, slug TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, UNIQUE (tenant_id, slug));
CREATE TABLE content_campaigns         (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, program_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE content_opportunities     (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, campaign_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE deliverable_requirements  (id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE creator_applications      (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, opportunity_id TEXT NOT NULL, creator_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, UNIQUE (opportunity_id, creator_id));
CREATE TABLE submissions               (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, opportunity_id TEXT NOT NULL, creator_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE content_assets            (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, campaign_id TEXT NOT NULL, creator_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE content_licenses          (id TEXT PRIMARY KEY, asset_id TEXT UNIQUE NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE rank_unlock_rules         (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, campaign_id TEXT, min_rank TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE creator_payments          (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, creator_id TEXT NOT NULL, submission_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE creator_disputes          (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, submission_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE evaluation_schemes        (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, program_id TEXT UNIQUE NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE program_capacities        (program_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE program_budgets           (program_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, currency TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE program_fee_settings      (program_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, rate_bps INT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE submission_dispositions   (submission_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, queue_state TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE business_plans            (key TEXT PRIMARY KEY, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE business_trials           (business_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, plan_key TEXT NOT NULL, state TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE promotional_channels      (id TEXT PRIMARY KEY, tenant_id TEXT, kind TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE promoted_placements       (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, tenant_id TEXT, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE pilot_checklists          (business_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);

-- ---- Creator Marketplace (append-only) ----
CREATE TABLE submission_versions       (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, seq INT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE submission_reviews        (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, submission_id TEXT NOT NULL, version_id TEXT NOT NULL, decision TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE creator_ledger_events     (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, creator_id TEXT NOT NULL, payment_id TEXT NOT NULL, type TEXT NOT NULL, data JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL);

-- ---- Shopify adapter ----
CREATE TABLE shopify_installations     (id TEXT PRIMARY KEY, shop TEXT UNIQUE NOT NULL, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, organization_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, installed_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE shopify_sessions          (shop TEXT PRIMARY KEY, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE webhook_events            (id TEXT PRIMARY KEY, shop TEXT NOT NULL, tenant_id TEXT, topic TEXT NOT NULL, webhook_id TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL, UNIQUE (shop, topic, webhook_id));
CREATE TABLE onboarding_states         (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, activated BOOLEAN NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE storage_connections       (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, business_id TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, version INT NOT NULL DEFAULT 1, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL);

-- ---- Tenant-scoped indexes (isolation + common lookups) ----
CREATE INDEX ix_creator_programs_tenant       ON creator_programs (tenant_id);
CREATE INDEX ix_content_campaigns_tp          ON content_campaigns (tenant_id, program_id);
CREATE INDEX ix_content_opps_tc               ON content_opportunities (tenant_id, campaign_id);
CREATE INDEX ix_content_opps_ts               ON content_opportunities (tenant_id, status);
CREATE INDEX ix_submissions_ts                ON submissions (tenant_id, status);
CREATE INDEX ix_submissions_tc                ON submissions (tenant_id, creator_id);
CREATE INDEX ix_creator_payments_ts           ON creator_payments (tenant_id, status);
CREATE INDEX ix_creator_ledger_tp             ON creator_ledger_events (tenant_id, payment_id);
CREATE INDEX ix_dispositions_tq               ON submission_dispositions (tenant_id, queue_state);
CREATE INDEX ix_installations_tenant          ON shopify_installations (tenant_id);
CREATE INDEX ix_webhooks_status               ON webhook_events (status);
CREATE INDEX ix_onboarding_tenant             ON onboarding_states (tenant_id);
CREATE INDEX ix_storage_tenant                ON storage_connections (tenant_id);

-- ---- Append-only guards ----
CREATE TRIGGER trg_submission_versions_ao  BEFORE UPDATE OR DELETE ON submission_versions   FOR EACH ROW EXECUTE FUNCTION partnera_block_mutation();
CREATE TRIGGER trg_submission_reviews_ao   BEFORE UPDATE OR DELETE ON submission_reviews    FOR EACH ROW EXECUTE FUNCTION partnera_block_mutation();
CREATE TRIGGER trg_creator_ledger_ao       BEFORE UPDATE OR DELETE ON creator_ledger_events FOR EACH ROW EXECUTE FUNCTION partnera_block_mutation();

-- Optional: Row-Level Security templates per tenant can be layered here (see 0001_init.sql).
