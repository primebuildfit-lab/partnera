import { type ReactNode } from "react";
import { Alert, Badge, Card, type Column, EmptyState, Table, tokens } from "@partnera/ui";
import { type CommissionRecord } from "@partnera/commission-engine";
import { type PayoutRequest } from "@partnera/payment-engine";
import { type PageContext } from "../page";
import { PageHeader, StatTile, StatusBadge, DefinitionList } from "../components";
import { money, date, dateTime, num } from "../format";
import { renderAffiliateContent } from "./creator";

/** Affiliate Portal — consumes the same services, scoped to the affiliate. */
export async function renderAffiliate(pc: PageContext): Promise<ReactNode> {
  const affiliateId = pc.ctx.session.affiliateId;
  if (!affiliateId) {
    return (
      <>
        <PageHeader title="Affiliate Portal" />
        <Card>
          <Alert intent="warning" title="No affiliate identity">
            This account is not linked to an affiliate. In production the auth provider maps the
            signed-in identity to an affiliate; sign in as the demo affiliate (brian@primebuild.test)
            to explore the portal.
          </Alert>
        </Card>
      </>
    );
  }

  const sub = pc.path.replace(/^\/affiliate\/?/, "");
  switch (sub) {
    case "":
      return performance(pc, affiliateId);
    case "profile":
      return profile(pc);
    case "links":
      return links(pc, affiliateId);
    case "coupons":
      return coupons(pc, affiliateId);
    case "pending":
      return earnings(pc, affiliateId, ["pending", "held"], "Pending commission");
    case "approved":
      return earnings(pc, affiliateId, ["approved"], "Approved commission");
    case "paid":
      return earnings(pc, affiliateId, ["paid"], "Paid commission");
    case "history":
      return earnings(pc, affiliateId, null, "Commission history");
    case "payouts":
      return payouts(pc, affiliateId);
    case "content":
      return renderAffiliateContent(pc);
    case "notifications":
      return notifications(pc);
    case "settings":
      return settings(pc);
    default:
      return <EmptyState title="Not found" />;
  }
}

async function performance(pc: PageContext, affiliateId: string): Promise<ReactNode> {
  const commissions = await pc.services.query.affiliateCommissions(pc.request, affiliateId as never);
  const bal = await pc.services.query.affiliateBalances(pc.request, affiliateId as never);
  const convs = pc.services.query.affiliateConversions(pc.request, affiliateId as never);
  const b = bal[0];
  return (
    <>
      <PageHeader title="Performance" description={`Welcome back. Affiliate ${affiliateId}.`} />
      <div className="pt-grid cols-4" style={{ marginBottom: tokens.space.xl }}>
        <StatTile label="Conversions" value={num(convs.length)} intent="info" />
        <StatTile label="Pending" value={b ? money(b.pending) : "$0.00"} intent="warning" />
        <StatTile label="Available" value={b ? money(b.available) : "$0.00"} intent="success" />
        <StatTile label="Paid to date" value={b ? money(b.paid) : "$0.00"} intent="primary" />
      </div>
      <Card title="Recent commissions">{commissionsTable(commissions.slice(0, 8))}</Card>
    </>
  );
}

function profile(pc: PageContext): ReactNode {
  const s = pc.ctx.session;
  return (
    <>
      <PageHeader title="Profile" />
      <Card>
        <DefinitionList
          items={[
            { term: "Name", value: s.displayName },
            { term: "Email", value: s.email },
            { term: "Affiliate id", value: <code>{s.affiliateId}</code> },
            { term: "Program", value: "PrimeBuild" },
          ]}
        />
      </Card>
    </>
  );
}

function links(pc: PageContext, affiliateId: string): ReactNode {
  const rows = pc.services.query.affiliateLinks(pc.request, affiliateId as never);
  return (
    <>
      <PageHeader title="Referral Links" description="Share these links to earn commission." />
      <Card>
        <Table
          columns={[
            { key: "code", header: "Code", render: (l: (typeof rows)[number]) => <code>{l.code}</code> },
            { key: "url", header: "Share URL", render: (l) => <code>{`https://primebuild.test/?ref=${l.code}`}</code> },
            { key: "created", header: "Created", render: (l) => date(l.createdAt) },
          ]}
          rows={rows}
          getRowKey={(l) => l.id}
          emptyTitle="No links yet"
        />
      </Card>
    </>
  );
}

function coupons(pc: PageContext, affiliateId: string): ReactNode {
  const rows = pc.services.query.affiliateCoupons(pc.request, affiliateId as never);
  return (
    <>
      <PageHeader title="Coupons" description="Coupon codes attributed to you." />
      <Card>
        <Table
          columns={[
            { key: "code", header: "Code", render: (c: (typeof rows)[number]) => <code>{c.code}</code> },
            { key: "created", header: "Created", render: (c) => date(c.createdAt) },
          ]}
          rows={rows}
          getRowKey={(c) => c.id}
          emptyTitle="No coupons yet"
        />
      </Card>
    </>
  );
}

async function earnings(
  pc: PageContext,
  affiliateId: string,
  states: readonly string[] | null,
  title: string,
): Promise<ReactNode> {
  const all = await pc.services.query.affiliateCommissions(pc.request, affiliateId as never);
  const rows = states ? all.filter((c) => states.includes(c.state)) : all;
  return (
    <>
      <PageHeader title={title} />
      <Card>{commissionsTable(rows)}</Card>
    </>
  );
}

async function payouts(pc: PageContext, affiliateId: string): Promise<ReactNode> {
  const rows = await pc.services.query.affiliatePayouts(pc.request, affiliateId as never);
  const columns: Column<PayoutRequest>[] = [
    { key: "id", header: "Payout", render: (p) => <code>{p.payoutId}</code> },
    { key: "amt", header: "Amount", align: "right", render: (p) => money(p.amount) },
    { key: "state", header: "State", render: (p) => <StatusBadge status={p.state} /> },
    { key: "created", header: "Requested", render: (p) => dateTime(p.createdAt) },
  ];
  return (
    <>
      <PageHeader title="Payouts" description="Withdrawals of your available balance (non-custodial)." />
      <Card>
        <Table columns={columns} rows={rows} getRowKey={(p) => p.payoutId} emptyTitle="No payouts yet" />
      </Card>
      <div style={{ marginTop: tokens.space.lg }}>
        <Alert intent="info" title="Future payout methods">
          Payout method management (bank, PayPal, store credit) is prepared behind the PayoutRail
          abstraction and will appear here once a provider is connected. No provider ships today.
        </Alert>
      </div>
    </>
  );
}

function notifications(pc: PageContext): ReactNode {
  const items = pc.services.notifications.listForRecipient(pc.request, pc.ctx.session.userId);
  return (
    <>
      <PageHeader title="Notifications" />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="No notifications" description="Approvals and payouts will show here." />
        ) : (
          <Table
            columns={[
              { key: "tpl", header: "Template", render: (n: (typeof items)[number]) => n.templateKey },
              { key: "ch", header: "Channel", render: (n) => n.channel },
              { key: "status", header: "Status", render: (n) => <StatusBadge status={n.status} /> },
            ]}
            rows={items}
            getRowKey={(n) => n.id}
          />
        )}
      </Card>
    </>
  );
}

function settings(_pc: PageContext): ReactNode {
  return (
    <>
      <PageHeader title="Settings" />
      <Card>
        <DefinitionList
          items={[
            { term: "Notification channels", value: <Badge intent="success">email, in-app</Badge> },
            { term: "Payout method", value: "Not configured (provider pending)" },
            { term: "Two-factor", value: "Prepared (MFA seam) — not yet enabled" },
          ]}
        />
      </Card>
    </>
  );
}

function commissionsTable(rows: readonly CommissionRecord[]): JSX.Element {
  const columns: Column<CommissionRecord>[] = [
    { key: "id", header: "Commission", render: (c) => <code>{c.commissionId}</code> },
    { key: "amt", header: "Amount", align: "right", render: (c) => money(c.amount) },
    { key: "state", header: "State", render: (c) => <StatusBadge status={c.state} /> },
    { key: "created", header: "Date", render: (c) => date(c.createdAt) },
  ];
  return <Table columns={columns} rows={rows} getRowKey={(c) => c.commissionId} emptyTitle="Nothing here yet" />;
}
