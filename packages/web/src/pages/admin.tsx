import { type ReactNode } from "react";
import { Alert, Badge, Card, type Column, EmptyState, Table, tokens } from "@partnera/ui";
import { type Role, type User } from "@partnera/auth";
import { type AuditLogEntry } from "@partnera/platform";
import { type PageContext } from "../page";
import { PageHeader, StatTile, StatusBadge, DefinitionList } from "../components";
import { date, dateTime, num } from "../format";

/**
 * Admin Console — the operational structure for Partnera platform operators.
 * Per the brief this establishes the shape and wires the read surfaces; it does
 * not implement every operator feature.
 */
export async function renderAdmin(pc: PageContext): Promise<ReactNode> {
  const sub = pc.path.replace(/^\/admin\/?/, "");
  switch (sub) {
    case "":
      return overview(pc);
    case "health":
      return health(pc);
    case "logs":
      return logs(pc);
    case "organizations":
      return organizations(pc);
    case "users":
      return users(pc);
    case "permissions":
      return permissions(pc);
    case "offers":
      return offers(pc);
    case "tracking":
      return tracking(pc);
    case "fraud":
      return fraud(pc);
    case "flags":
      return flags(pc);
    case "configuration":
      return configuration(pc);
    case "audit":
      return audit(pc);
    case "data":
      return dataStatus(pc);
    default:
      return <EmptyState title="Not found" />;
  }
}

/**
 * Local data-status view (Part 7): where data lives, when it was last saved,
 * record counts, and a deterministic integrity check. User-facing language; no
 * secrets or private creator content.
 */
function dataStatus(pc: PageContext): ReactNode {
  const p = pc.persistence;
  const integrity = pc.services.creator.integrityCheck(pc.request);
  const counts = integrity.counts;
  const pilotProgram = pc.services.creator.listPrograms(pc.request).find((x) => x.slug === "creators");
  return (
    <>
      <PageHeader title="Local data status" description="How and where this Partnera install stores its data. Everything is on this machine — no external database or cloud." />
      <div className="pt-grid cols-4">
        <StatTile label="Storage" value={p?.mode === "local-file" ? "Local file" : "In-memory"} note={p?.mode === "local-file" ? "Survives restart" : "Test/session only"} />
        <StatTile label="Last saved" value={p?.lastSaveAt ? dateTime(p.lastSaveAt) : "—"} intent="info" />
        <StatTile label="Integrity" value={integrity.ok ? "OK" : `${integrity.issues.length} issue(s)`} intent={integrity.ok ? "success" : "danger"} />
        <StatTile label="PrimeBuild pilot" value={pilotProgram ? "Configured" : "Missing"} intent={pilotProgram ? "success" : "warning"} />
      </div>
      <div className="pt-grid cols-2" style={{ marginTop: tokens.space.lg }}>
        <Card title="Storage details">
          <DefinitionList items={[
            { term: "Mode", value: p?.mode === "local-file" ? "Local file (JSON)" : "In-memory (no file)" },
            { term: "Data file", value: p?.dataFile ?? "—" },
            { term: "Backups", value: p?.backupDir ? `${p.backupDir} (via launcher backup/restore)` : "—" },
            { term: "Data version", value: "1" },
          ]} />
          {p?.mode === "local-file" && <p style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.xs, marginTop: tokens.space.sm }}>Back up with <code>partnera backup</code>; restore with <code>partnera restore</code> while stopped.</p>}
        </Card>
        <Card title="Integrity check">
          {integrity.ok ? (
            <Alert intent="success">No inconsistencies found (no duplicate programs/schemes, categories valid, fee in range, no cross-tenant records).</Alert>
          ) : (
            <ul style={{ margin: 0, paddingLeft: tokens.space.lg, color: tokens.color.text }}>{integrity.issues.map((i, n) => <li key={n}>{i}</li>)}</ul>
          )}
        </Card>
      </div>
      <div style={{ marginTop: tokens.space.lg }}>
        <Card title="Record counts">
          <DefinitionList items={Object.entries(counts).map(([k, v]) => ({ term: k.replace(/_/g, " "), value: String(v) }))} />
        </Card>
      </div>
    </>
  );
}

async function overview(pc: PageContext): Promise<ReactNode> {
  const orgs = pc.services.query.organizations(pc.request);
  const users = pc.services.query.users(pc.request);
  const offers = pc.services.query.offers(pc.request);
  const cases = pc.services.query.fraudCases(pc.request);
  return (
    <>
      <PageHeader title="Operations Overview" description="Platform-wide health and volume." />
      <div className="pt-grid cols-4">
        <StatTile label="Organizations" value={orgs.length} />
        <StatTile label="Users" value={users.length} intent="info" />
        <StatTile label="Offers" value={offers.length} intent="primary" />
        <StatTile label="Open fraud" value={cases.filter((c) => c.status !== "resolved").length} intent="danger" />
      </div>
    </>
  );
}

function health(_pc: PageContext): ReactNode {
  const subsystems = [
    { name: "Domain engines", status: "healthy" },
    { name: "Persistence (relational store)", status: "healthy" },
    { name: "Application services", status: "healthy" },
    { name: "Payments integrity", status: "healthy" },
    { name: "Payout rail", status: "not_configured" },
    { name: "Auth provider", status: "not_configured" },
  ];
  return (
    <>
      <PageHeader title="Health" description="Subsystem status (structure; live probes are a later module)." />
      <Card>
        <Table
          columns={[
            { key: "name", header: "Subsystem", render: (s: (typeof subsystems)[number]) => s.name },
            {
              key: "status",
              header: "Status",
              render: (s) => (
                <Badge intent={s.status === "healthy" ? "success" : "warning"}>{s.status.replace(/_/g, " ")}</Badge>
              ),
            },
          ]}
          rows={subsystems}
          getRowKey={(s) => s.name}
        />
      </Card>
    </>
  );
}

function logs(pc: PageContext): ReactNode {
  // Operational logs are surfaced from the immutable audit trail for now.
  const entries = pc.services.query.auditLog(pc.request).slice(0, 50);
  return (
    <>
      <PageHeader title="Logs" description="Recent platform activity (from the audit trail)." />
      <Card>
        <Table
          columns={logColumns()}
          rows={entries}
          getRowKey={(e) => e.id}
          emptyTitle="No activity yet"
        />
      </Card>
    </>
  );
}

function organizations(pc: PageContext): ReactNode {
  const orgs = pc.services.query.organizations(pc.request);
  return (
    <>
      <PageHeader title="Organizations" description="Tenants on the platform." />
      <Card>
        <Table
          columns={[
            { key: "name", header: "Name", render: (o: (typeof orgs)[number]) => o.name },
            { key: "id", header: "Id", render: (o) => <code>{o.id}</code> },
            { key: "created", header: "Created", render: (o) => date(o.createdAt) },
          ]}
          rows={orgs}
          getRowKey={(o) => o.id}
          emptyTitle="No organizations"
        />
      </Card>
    </>
  );
}

function users(pc: PageContext): ReactNode {
  const rows = pc.services.query.users(pc.request);
  const columns: Column<User>[] = [
    { key: "name", header: "Name", render: (u) => u.displayName },
    { key: "email", header: "Email", render: (u) => u.email },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
    { key: "created", header: "Created", render: (u) => date(u.createdAt) },
  ];
  return (
    <>
      <PageHeader title="Users" description="People with access to the platform." />
      <Card>
        <Table columns={columns} rows={rows} getRowKey={(u) => u.id} emptyTitle="No users" />
      </Card>
    </>
  );
}

function permissions(pc: PageContext): ReactNode {
  const roles = pc.services.query.roles(pc.request);
  const columns: Column<Role>[] = [
    { key: "name", header: "Role", render: (r) => r.name },
    { key: "scope", header: "Scope", render: (r) => <Badge intent="info">{r.scopeLevel}</Badge> },
    { key: "system", header: "System", render: (r) => (r.isSystem ? "yes" : "no") },
    { key: "perms", header: "Grants", align: "right", render: (r) => num(r.permissions.length) },
  ];
  return (
    <>
      <PageHeader title="Permissions" description="Data-driven RBAC roles and their grants." />
      <Card>
        <Table columns={columns} rows={roles} getRowKey={(r) => r.id} emptyTitle="No roles" />
      </Card>
    </>
  );
}

function offers(pc: PageContext): ReactNode {
  const rows = pc.services.query.offers(pc.request);
  return (
    <>
      <PageHeader title="Offers" description="All offers across tenants (read-only operator view)." />
      <Card>
        <Table
          columns={[
            { key: "name", header: "Name", render: (o: (typeof rows)[number]) => o.name },
            { key: "tenant", header: "Tenant", render: (o) => <code>{o.tenantId}</code> },
            { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
          ]}
          rows={rows}
          getRowKey={(o) => o.id}
          emptyTitle="No offers"
        />
      </Card>
    </>
  );
}

function tracking(pc: PageContext): ReactNode {
  const convs = pc.services.query.conversions(pc.request);
  return (
    <>
      <PageHeader title="Tracking" description="Conversion volume across the platform." />
      <div className="pt-grid cols-3" style={{ marginBottom: tokens.space.lg }}>
        <StatTile label="Conversions" value={num(convs.length)} />
        <StatTile label="Reversed" value={num(convs.filter((c) => c.reversed).length)} intent="danger" />
        <StatTile label="Links + coupons" value={num(pc.services.query.links(pc.request).length + pc.services.query.coupons(pc.request).length)} intent="info" />
      </div>
    </>
  );
}

function fraud(pc: PageContext): ReactNode {
  const cases = pc.services.query.fraudCases(pc.request);
  return (
    <>
      <PageHeader title="Fraud" description="Cross-tenant fraud posture (structure)." />
      <Card>
        <DefinitionList
          items={[
            { term: "Total cases", value: cases.length },
            { term: "Open", value: <Badge intent="danger">{cases.filter((c) => c.status !== "resolved").length}</Badge> },
            { term: "Platform floors", value: "self_purchase, chargeback (cannot be disabled by tenants)" },
          ]}
        />
      </Card>
    </>
  );
}

function flags(_pc: PageContext): ReactNode {
  return (
    <>
      <PageHeader title="Feature Flags" description="Plan/tenant/rollout gating (platform module)." />
      <Card>
        <Alert intent="info" title="Operational structure ready">
          The feature-flag engine (`@partnera/platform`) supports plan/tenant/rollout gating with
          stable hashing. A management surface for editing flags is scheduled for a later module;
          this page reserves its place in the operator IA.
        </Alert>
      </Card>
    </>
  );
}

async function configuration(_pc: PageContext): Promise<ReactNode> {
  return (
    <>
      <PageHeader title="Configuration" description="Platform-scope configuration." />
      <Card>
        <DefinitionList
          items={[
            { term: "Min payout (minor units)", value: "2000 (default)" },
            { term: "Default clawback (days)", value: "30 (default)" },
            { term: "Scope", value: "platform + per-business overrides" },
          ]}
        />
      </Card>
    </>
  );
}

function audit(pc: PageContext): ReactNode {
  const entries = pc.services.query.auditLog(pc.request);
  return (
    <>
      <PageHeader title="Audit" description="Immutable platform audit trail." />
      <Card>
        <Table columns={logColumns()} rows={entries} getRowKey={(e) => e.id} emptyTitle="No entries" />
      </Card>
    </>
  );
}

function logColumns(): Column<AuditLogEntry>[] {
  return [
    { key: "at", header: "When", render: (e) => dateTime(e.at) },
    { key: "actor", header: "Actor", render: (e) => e.actorUserId },
    { key: "action", header: "Action", render: (e) => <Badge intent="info">{e.action}</Badge> },
    { key: "res", header: "Resource", render: (e) => `${e.resourceType}:${e.resourceId}` },
    { key: "op", header: "Operator", render: (e) => (e.byPlatformOperator ? "yes" : "—") },
  ];
}
