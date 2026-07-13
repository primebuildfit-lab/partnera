import { type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  type Column,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
  tokens,
} from "@partnera/ui";
import { type Balance, type CommissionRecord } from "@partnera/commission-engine";
import { type Conversion } from "@partnera/tracking-engine";
import { type FraudCase } from "@partnera/fraud-engine";
import { type AuditLogEntry, PLATFORM_CONFIG } from "@partnera/platform";
import { type OfferRow } from "@partnera/persistence";
import { type OfferId } from "@partnera/core";
import { type PageContext } from "../page";
import { PageHeader, StatTile, StatusBadge, DefinitionList, BarChart } from "../components";
import { money, moneyJson, minor, date, dateTime, num, titleCase } from "../format";
import { renderBusinessCreators } from "./creator";

/** Business Dashboard — every section is connected to the real services. */
export async function renderBusiness(pc: PageContext): Promise<ReactNode> {
  const sub = pc.path.replace(/^\/business\/?/, "");
  switch (true) {
    case sub === "":
      return overview(pc);
    case sub === "analytics":
      return analytics(pc);
    case sub === "offers":
      return offersList(pc);
    case sub.startsWith("offers/"):
      return offerDetail(pc, sub.slice("offers/".length));
    case sub === "campaigns":
      return campaigns(pc);
    case sub === "tracking":
      return tracking(pc);
    case sub === "conversions":
      return conversions(pc);
    case sub === "commissions":
      return commissions(pc);
    case sub === "balances":
      return balances(pc);
    case sub === "fraud":
      return fraud(pc);
    case sub === "notifications":
      return notifications(pc);
    case sub === "configuration":
      return configuration(pc);
    case sub === "audit":
      return audit(pc);
    case sub === "organization":
      return organization(pc);
    case sub === "creators" || sub.startsWith("creators/"):
      return renderBusinessCreators(pc);
    default:
      return <EmptyState title="Not found" description={`No business page for “${sub}”.`} />;
  }
}

function Flash({ pc }: { pc: PageContext }): JSX.Element | null {
  if (!pc.flash) return null;
  return (
    <div style={{ marginBottom: tokens.space.lg }}>
      <Alert intent={pc.flash.intent}>{pc.flash.message}</Alert>
    </div>
  );
}

async function overview(pc: PageContext): Promise<ReactNode> {
  const { query } = pc.services;
  const offers = query.offers(pc.request);
  const convs = query.conversions(pc.request);
  const commissions = await query.commissions(pc.request);
  const balances = await query.tenantBalances(pc.request);
  const cases = query.fraudCases(pc.request);

  const byState = (s: string) => commissions.filter((c) => c.state === s).length;
  const total = sumBalances(balances);

  return (
    <>
      <PageHeader title="Overview" description="Program health at a glance for PrimeBuild." />
      <Flash pc={pc} />
      <div className="pt-grid cols-4" style={{ marginBottom: tokens.space.xl }}>
        <StatTile label="Active offers" value={offers.filter((o) => o.status === "active").length} />
        <StatTile label="Conversions" value={num(convs.length)} intent="info" />
        <StatTile label="Approved payable" value={total.available} intent="success" />
        <StatTile label="Open fraud cases" value={cases.filter((c) => c.status !== "resolved").length} intent="danger" />
      </div>
      <div className="pt-grid cols-2">
        <Card title="Commission pipeline">
          <div className="pt-row" style={{ gap: tokens.space.lg }}>
            {["pending", "held", "approved", "paid", "reversed"].map((s) => (
              <div key={s} style={{ textAlign: "center" }}>
                <div style={{ fontSize: tokens.font.size.xl, fontWeight: 700 }}>{byState(s)}</div>
                <StatusBadge status={s} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recent commissions">
          {commissionsTable(commissions.slice(0, 6))}
        </Card>
      </div>
    </>
  );
}

async function analytics(pc: PageContext): Promise<ReactNode> {
  const { query } = pc.services;
  const orders = query.orders(pc.request);
  const convs = query.conversions(pc.request);
  const commissions = await query.commissions(pc.request);
  const offers = query.offers(pc.request);

  const revenue = orders.reduce((sum, o) => sum + Number(BigInt(o.totalMinorUnits)), 0);
  const affiliates = new Set(convs.map((c) => c.affiliateId));
  const byOffer = new Map<string, number>();
  for (const c of commissions) {
    byOffer.set(c.offerId, (byOffer.get(c.offerId) ?? 0) + Number(c.amount.minorUnits));
  }
  const offerName = (id: string) => offers.find((o) => o.id === id)?.name ?? id;
  const topOffers = [...byOffer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, v]) => ({ label: offerName(id), value: v, display: minor(String(v), "USD") }));

  const statusCounts = ["pending", "held", "approved", "paid", "reversed", "rejected"].map((s) => ({
    label: titleCase(s),
    value: commissions.filter((c) => c.state === s).length,
  }));

  const growth = growthByDay(convs);

  return (
    <>
      <PageHeader title="Analytics" description="Revenue, conversions, and program performance." />
      <div className="pt-grid cols-4" style={{ marginBottom: tokens.space.xl }}>
        <StatTile label="Attributed revenue" value={minor(String(revenue), "USD")} />
        <StatTile label="Conversions" value={num(convs.length)} intent="info" />
        <StatTile label="Active affiliates" value={affiliates.size} intent="success" />
        <StatTile label="Commissions" value={num(commissions.length)} intent="primary" />
      </div>
      <div className="pt-grid cols-2">
        <Card title="Top offers by commission">
          {topOffers.length ? <BarChart label="Top offers by commission" data={topOffers} /> : <EmptyState title="No commissions yet" />}
        </Card>
        <Card title="Commission status">
          <BarChart label="Commission status breakdown" data={statusCounts} intent="info" />
        </Card>
        <Card title="Conversions over time">
          <BarChart label="Conversions per day" data={growth} intent="success" />
        </Card>
        <Card title="Fraud overview">
          {fraudOverview(pc)}
        </Card>
      </div>
    </>
  );
}

function fraudOverview(pc: PageContext): ReactNode {
  const cases = pc.services.query.fraudCases(pc.request);
  const open = cases.filter((c) => c.status !== "resolved").length;
  return (
    <DefinitionList
      items={[
        { term: "Total cases", value: cases.length },
        { term: "Open", value: <Badge intent={open ? "danger" : "success"}>{open}</Badge> },
        { term: "Resolved", value: cases.filter((c) => c.status === "resolved").length },
      ]}
    />
  );
}

function offersList(pc: PageContext): ReactNode {
  const offers = pc.services.query.offers(pc.request);
  const canCreate = pc.ctx.can("offers.create");
  const columns: Column<OfferRow>[] = [
    { key: "name", header: "Name", render: (o) => <a href={`/business/offers/${o.id}`}>{o.name}</a> },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
    { key: "ver", header: "Versions", render: (o) => o.latestVersion, align: "right" },
    { key: "active", header: "Active v", render: (o) => o.activeVersion ?? "—", align: "right" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <div className="pt-row" style={{ justifyContent: "flex-end", gap: tokens.space.xs }}>
          {pc.ctx.can("offers.create") ? <PostButton action={`/business/offers/${o.id}/duplicate`} label="Duplicate" variant="ghost" /> : null}
          {pc.ctx.can("offers.update") && o.status !== "archived" ? (
            <PostButton action={`/business/offers/${o.id}/archive`} label="Archive" variant="ghost" intent="neutral" />
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Offers"
        description="Configurable, versioned offers. Editing appends a version; activation never overwrites."
      />
      <Flash pc={pc} />
      <div className="pt-grid cols-2">
        <Card title="All offers">
          <Table columns={columns} rows={offers} getRowKey={(o) => o.id} emptyTitle="No offers yet" />
        </Card>
        {canCreate ? (
          <Card title="Create offer">
            <CreateOfferForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}

async function offerDetail(pc: PageContext, rest: string): Promise<ReactNode> {
  const offerId = rest.split("/")[0] as OfferId;
  const offer = pc.services.query.offers(pc.request).find((o) => o.id === offerId);
  if (!offer) return <EmptyState title="Offer not found" />;
  const versions = pc.services.query.offerVersions(pc.request, offerId);
  return (
    <>
      <PageHeader
        title={offer.name}
        description={`Program ${offer.programId}`}
        actions={<a href="/business/offers">← All offers</a>}
      />
      <Flash pc={pc} />
      <div className="pt-grid cols-2">
        <Card title="Summary">
          <DefinitionList
            items={[
              { term: "Status", value: <StatusBadge status={offer.status} /> },
              { term: "Latest version", value: offer.latestVersion },
              { term: "Active version", value: offer.activeVersion ?? "none" },
              { term: "Stacking priority", value: offer.stackingPriority },
              { term: "Created", value: date(offer.createdAt) },
            ]}
          />
          {pc.ctx.can("offers.activate") ? (
            <form method="post" action={`/business/offers/${offer.id}/activate`} style={{ marginTop: tokens.space.lg }}>
              <div className="pt-row">
                <Field label="Activate version" htmlFor="version">
                  <Input id="version" name="version" defaultValue={String(offer.latestVersion)} style={{ width: 80 }} />
                </Field>
                <Button type="submit">Activate</Button>
              </div>
            </form>
          ) : null}
        </Card>
        <Card title="Versions (immutable)">
          <Table
            columns={[
              { key: "v", header: "Version", render: (v: (typeof versions)[number]) => v.version },
              { key: "calc", header: "Calculation", render: (v) => describeCalc(v.definition.calculation) },
              { key: "reward", header: "Reward", render: (v) => v.definition.reward.kind },
              { key: "created", header: "Created", render: (v) => date(v.createdAt) },
            ]}
            rows={versions}
            getRowKey={(v) => String(v.version)}
          />
        </Card>
      </div>
    </>
  );
}

function campaigns(_pc: PageContext): ReactNode {
  return (
    <>
      <PageHeader title="Campaigns" description="Group offers into launches, seasonal, and contest campaigns." />
      <Card>
        <Alert intent="info" title="Operational structure ready">
          Campaign attribution is modeled in the domain (offers carry a campaign condition), and the
          navigation and permission surface exist. A dedicated campaign repository/service is scheduled
          for a later module — no campaign data is fabricated here. See docs/24-delivery-ux.md.
        </Alert>
      </Card>
    </>
  );
}

function tracking(pc: PageContext): ReactNode {
  const links = pc.services.query.links(pc.request);
  const coupons = pc.services.query.coupons(pc.request);
  return (
    <>
      <PageHeader title="Tracking" description="Referral links and affiliate coupons." />
      <div className="pt-grid cols-2">
        <Card title="Referral links">
          <Table
            columns={[
              { key: "code", header: "Code", render: (l: (typeof links)[number]) => <code>{l.code}</code> },
              { key: "aff", header: "Affiliate", render: (l) => l.affiliateId },
              { key: "created", header: "Created", render: (l) => date(l.createdAt) },
            ]}
            rows={links}
            getRowKey={(l) => l.id}
            emptyTitle="No links yet"
          />
        </Card>
        <Card title="Coupons">
          <Table
            columns={[
              { key: "code", header: "Code", render: (c: (typeof coupons)[number]) => <code>{c.code}</code> },
              { key: "aff", header: "Affiliate", render: (c) => c.affiliateId },
              { key: "created", header: "Created", render: (c) => date(c.createdAt) },
            ]}
            rows={coupons}
            getRowKey={(c) => c.id}
            emptyTitle="No coupons yet"
          />
        </Card>
      </div>
    </>
  );
}

function conversions(pc: PageContext): ReactNode {
  const convs = pc.services.query.conversions(pc.request);
  const columns: Column<Conversion>[] = [
    { key: "order", header: "Order", render: (c) => <code>{c.orderId}</code> },
    { key: "aff", header: "Affiliate", render: (c) => c.affiliateId },
    { key: "basis", header: "Basis", render: (c) => <Badge intent="info">{c.basis}</Badge> },
    { key: "when", header: "Attributed", render: (c) => dateTime(c.attributedAt) },
    { key: "rev", header: "Reversed", render: (c) => (c.reversed ? <Badge intent="danger">reversed</Badge> : "—") },
  ];
  return (
    <>
      <PageHeader title="Conversions" description="Attributed orders with an explicit basis." />
      <Card>
        <Table columns={columns} rows={convs} getRowKey={(c) => c.id} emptyTitle="No conversions yet" />
      </Card>
    </>
  );
}

async function commissions(pc: PageContext): Promise<ReactNode> {
  const rows = await pc.services.query.commissions(pc.request);
  const canApprove = pc.ctx.can("commissions.approve");
  const columns: Column<CommissionRecord>[] = [
    { key: "id", header: "Commission", render: (c) => <code>{c.commissionId}</code> },
    { key: "aff", header: "Affiliate", render: (c) => c.affiliateId },
    { key: "amt", header: "Amount", align: "right", render: (c) => money(c.amount) },
    { key: "state", header: "State", render: (c) => <StatusBadge status={c.state} /> },
    { key: "created", header: "Created", render: (c) => date(c.createdAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) =>
        canApprove && (c.state === "pending" || c.state === "held") ? (
          <div className="pt-row" style={{ justifyContent: "flex-end", gap: tokens.space.xs }}>
            <PostButton action={`/business/commissions/${c.commissionId}/approve`} label="Approve" intent="success" />
            <PostButton action={`/business/commissions/${c.commissionId}/reject`} label="Reject" intent="danger" variant="outline" />
          </div>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <>
      <PageHeader title="Commissions" description="Append-only ledger; approve or reject pending commissions." />
      <Flash pc={pc} />
      <Card>
        <Table columns={columns} rows={rows} getRowKey={(c) => c.commissionId} emptyTitle="No commissions yet" />
      </Card>
    </>
  );
}

async function balances(pc: PageContext): Promise<ReactNode> {
  const rows = await pc.services.query.tenantBalances(pc.request);
  const columns: Column<Balance>[] = [
    { key: "aff", header: "Affiliate", render: (b) => b.affiliateId },
    { key: "cur", header: "Currency", render: (b) => b.currency },
    { key: "pending", header: "Pending", align: "right", render: (b) => money(b.pending) },
    { key: "available", header: "Available", align: "right", render: (b) => money(b.available) },
    { key: "paid", header: "Paid", align: "right", render: (b) => money(b.paid) },
    { key: "reversed", header: "Reversed", align: "right", render: (b) => money(b.reversed) },
  ];
  return (
    <>
      <PageHeader title="Balances" description="Derived from the ledger — never stored as mutable numbers." />
      <Card>
        <Table columns={columns} rows={rows} getRowKey={(b) => `${b.affiliateId}:${b.currency}`} emptyTitle="No balances yet" />
      </Card>
    </>
  );
}

function fraud(pc: PageContext): ReactNode {
  const cases = pc.services.query.fraudCases(pc.request);
  const canReview = pc.ctx.can("fraud.review");
  const columns: Column<FraudCase>[] = [
    { key: "id", header: "Case", render: (c) => <code>{c.id}</code> },
    { key: "subject", header: "Subject", render: (c) => `${c.subjectKind}:${c.subjectId}` },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "opened", header: "Opened", render: (c) => dateTime(c.openedAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) =>
        canReview && c.status !== "resolved" ? (
          <form method="post" action={`/business/fraud/${c.id}/review`} className="pt-row" style={{ justifyContent: "flex-end" }}>
            <Select
              name="outcome"
              options={[
                { value: "cleared", label: "Clear" },
                { value: "confirmed_fraud", label: "Confirm fraud" },
                { value: "suspended", label: "Suspend" },
              ]}
              style={{ width: 150 }}
            />
            <input type="hidden" name="note" value="Reviewed from dashboard" />
            <Button type="submit" size="sm">
              Resolve
            </Button>
          </form>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <>
      <PageHeader title="Fraud & Trust" description="Held money routed to review — never deleted." />
      <Flash pc={pc} />
      <Card>
        <Table columns={columns} rows={cases} getRowKey={(c) => c.id} emptyTitle="No fraud cases" />
      </Card>
    </>
  );
}

function notifications(pc: PageContext): ReactNode {
  const items = pc.services.notifications.listForRecipient(pc.request, pc.ctx.session.userId);
  return (
    <>
      <PageHeader title="Notifications" description="Your queued and delivered notifications." />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="No notifications" description="Program events will appear here." />
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

async function configuration(pc: PageContext): Promise<ReactNode> {
  const minPayout = await pc.services.configuration.get(pc.request, PLATFORM_CONFIG.minPayoutMinorUnits.key);
  const clawback = await pc.services.configuration.get(pc.request, PLATFORM_CONFIG.defaultClawbackDays.key);
  const canWrite = pc.ctx.can("settings.update");
  return (
    <>
      <PageHeader title="Configuration" description="Per-tenant settings resolved by the platform config framework." />
      <Flash pc={pc} />
      <div className="pt-grid cols-2">
        <Card title="Current values">
          <DefinitionList
            items={[
              {
                term: PLATFORM_CONFIG.minPayoutMinorUnits.key,
                value: String(minPayout ?? PLATFORM_CONFIG.minPayoutMinorUnits.defaultValue) + " (min payout, minor units)",
              },
              {
                term: PLATFORM_CONFIG.defaultClawbackDays.key,
                value: String(clawback ?? PLATFORM_CONFIG.defaultClawbackDays.defaultValue) + " days",
              },
            ]}
          />
        </Card>
        {canWrite ? (
          <Card title="Update a value">
            <form method="post" action="/business/configuration">
              <Field label="Key" htmlFor="key">
                <Input id="key" name="key" defaultValue={PLATFORM_CONFIG.minPayoutMinorUnits.key} />
              </Field>
              <Field label="Value" htmlFor="value">
                <Input id="value" name="value" placeholder="e.g. 5000" />
              </Field>
              <Button type="submit" style={{ marginTop: tokens.space.md }}>
                Save
              </Button>
            </form>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function audit(pc: PageContext): ReactNode {
  const entries = pc.services.query.auditLog(pc.request);
  const columns: Column<AuditLogEntry>[] = [
    { key: "at", header: "When", render: (e) => dateTime(e.at) },
    { key: "actor", header: "Actor", render: (e) => e.actorUserId },
    { key: "action", header: "Action", render: (e) => <Badge intent="info">{e.action}</Badge> },
    { key: "res", header: "Resource", render: (e) => `${e.resourceType}:${e.resourceId}` },
  ];
  return (
    <>
      <PageHeader title="Audit" description="Immutable trail of sensitive actions." />
      <Card>
        <Table columns={columns} rows={entries} getRowKey={(e) => e.id} emptyTitle="No audit entries" />
      </Card>
    </>
  );
}

function organization(pc: PageContext): ReactNode {
  const biz = pc.services.query.business(pc.request);
  const orgs = pc.services.query.organizations(pc.request);
  return (
    <>
      <PageHeader title="Organization" description="Your tenant and its organization." />
      <div className="pt-grid cols-2">
        <Card title="Business">
          {biz ? (
            <DefinitionList
              items={[
                { term: "Name", value: biz.name },
                { term: "Status", value: <StatusBadge status={biz.status} /> },
                { term: "Plan", value: biz.planKey },
                { term: "Created", value: date(biz.createdAt) },
              ]}
            />
          ) : (
            <EmptyState title="No business" />
          )}
        </Card>
        <Card title="Organization">
          <Table
            columns={[
              { key: "name", header: "Name", render: (o: (typeof orgs)[number]) => o.name },
              { key: "created", header: "Created", render: (o) => date(o.createdAt) },
            ]}
            rows={orgs}
            getRowKey={(o) => o.id}
            emptyTitle="No organizations"
          />
        </Card>
      </div>
    </>
  );
}

// --- shared bits ---

function commissionsTable(rows: readonly CommissionRecord[]): JSX.Element {
  return (
    <Table
      columns={[
        { key: "aff", header: "Affiliate", render: (c: CommissionRecord) => c.affiliateId },
        { key: "amt", header: "Amount", align: "right", render: (c) => money(c.amount) },
        { key: "state", header: "State", render: (c) => <StatusBadge status={c.state} /> },
      ]}
      rows={rows}
      getRowKey={(c) => c.commissionId}
      emptyTitle="No commissions yet"
    />
  );
}

function CreateOfferForm(): JSX.Element {
  return (
    <form method="post" action="/business/offers">
      <Field label="Offer name" htmlFor="name" required>
        <Input id="name" name="name" placeholder="Sitewide 12% Cash" required />
      </Field>
      <Field label="Calculation" htmlFor="calc">
        <Select
          id="calc"
          name="calc"
          options={[
            { value: "percentage", label: "Percentage of order" },
            { value: "fixed", label: "Fixed amount" },
          ]}
        />
      </Field>
      <Field label="Value (bps for %, minor units for fixed)" htmlFor="value">
        <Input id="value" name="value" defaultValue="1200" />
      </Field>
      <Button type="submit" style={{ marginTop: tokens.space.md }}>
        Create draft offer
      </Button>
    </form>
  );
}

function PostButton(props: {
  action: string;
  label: string;
  intent?: "primary" | "success" | "danger" | "neutral";
  variant?: "solid" | "outline" | "ghost";
}): JSX.Element {
  return (
    <form method="post" action={props.action} style={{ display: "inline" }}>
      <Button type="submit" size="sm" intent={props.intent ?? "primary"} variant={props.variant ?? "solid"}>
        {props.label}
      </Button>
    </form>
  );
}

function describeCalc(calc: { kind: string; basisPoints?: number; amount?: { minorUnits: string; currency: string } }): string {
  if (calc.kind === "percentage") return `${(calc.basisPoints ?? 0) / 100}%`;
  if (calc.kind === "fixed" && calc.amount) return moneyJson(calc.amount);
  return calc.kind;
}

function sumBalances(balances: readonly Balance[]): { available: string; pending: string } {
  let available = 0n;
  let pending = 0n;
  for (const b of balances) {
    available += b.available.minorUnits;
    pending += b.pending.minorUnits;
  }
  const cur = balances[0]?.currency ?? "USD";
  return { available: minor(available.toString(), cur), pending: minor(pending.toString(), cur) };
}

function growthByDay(convs: readonly Conversion[]): { label: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const c of convs) {
    const d = date(c.attributedAt);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
}
