import { type ReactNode } from "react";
import { Alert, Badge, Button, Card, type Column, EmptyState, Field, Input, Table, tokens } from "@partnera/ui";
import {
  type AffiliateRank,
  type ContentOpportunity,
  type CreatorApplication,
  type CreatorPayment,
  type Submission,
} from "@partnera/creator-marketplace";
import { type PageContext } from "../page";
import { PageHeader, StatTile, StatusBadge, DefinitionList } from "../components";
import { moneyJson, titleCase } from "../format";

/**
 * Creator Marketplace surfaces. The Creator Portal (its own scope) plus the
 * business-side "Creators" section and the affiliate Content Library — all
 * rendered from the real services (no faked data). Local storage is metadata-only
 * and clearly labelled; payouts are SIMULATED (no provider, no real money).
 */

function Flash({ pc }: { pc: PageContext }): JSX.Element | null {
  if (!pc.flash) return null;
  return <div style={{ marginBottom: tokens.space.lg }}><Alert intent={pc.flash.intent}>{pc.flash.message}</Alert></div>;
}

function PostButton(props: { action: string; label: string; intent?: "primary" | "success" | "danger" | "neutral"; variant?: "solid" | "outline" | "ghost" }): JSX.Element {
  return (
    <form method="post" action={props.action} style={{ display: "inline" }}>
      <Button type="submit" size="sm" intent={props.intent ?? "primary"} variant={props.variant ?? "solid"}>{props.label}</Button>
    </form>
  );
}

const DemoNote = ({ children }: { children: ReactNode }): JSX.Element => (
  <p style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.xs, marginTop: tokens.space.sm }}>{children}</p>
);

// ==========================================================================
// Creator Portal (scope: /creator)
// ==========================================================================

export async function renderCreator(pc: PageContext): Promise<ReactNode> {
  const sub = pc.path.replace(/^\/creator\/?/, "");
  switch (true) {
    case sub === "":
      return creatorOverview(pc);
    case sub === "discover":
      return creatorDiscover(pc);
    case sub === "jobs":
      return creatorJobs(pc);
    case sub === "earnings":
      return creatorEarnings(pc);
    case sub === "profile":
      return creatorProfile(pc);
    default:
      return <EmptyState title="Not found" description={`No creator page for “${sub}”.`} />;
  }
}

async function creatorOverview(pc: PageContext): Promise<ReactNode> {
  const svc = pc.services.creator;
  const profile = svc.myProfile(pc.request);
  if (!profile) {
    return (
      <>
        <PageHeader title="Creator Portal" />
        <Flash pc={pc} />
        <Card title="Create your creator profile">
          <form method="post" action="/creator/profile" className="pt-stack">
            <Field label="Display name" htmlFor="displayName"><Input id="displayName" name="displayName" defaultValue="New Creator" /></Field>
            <Button type="submit">Create profile</Button>
          </form>
          <DemoNote>Local demo — no personal data is collected or stored externally.</DemoNote>
        </Card>
      </>
    );
  }
  const balances = await svc.myBalances(pc.request);
  const subs = svc.mySubmissions(pc.request);
  const open = svc.discoverOpportunities().length;
  const paid = balances.find((b) => b.currency === "USD");
  return (
    <>
      <PageHeader title={`Welcome, ${profile.displayName}`} description="Your creator work, submissions, and earnings." />
      <Flash pc={pc} />
      <div className="pt-grid cols-3">
        <StatTile label="Open opportunities" value={open} note="Discover companies to create for" />
        <StatTile label="My submissions" value={subs.length} intent="info" />
        <StatTile label="Paid (USD)" value={paid ? moneyJson(paid.paid) : "$0.00"} intent="success" note="Simulated in local mode" />
      </div>
      <div style={{ marginTop: tokens.space.lg }}>
        <Card title="Next steps">
          <ul style={{ margin: 0, paddingLeft: tokens.space.lg, color: tokens.color.text }}>
            <li><a href="/creator/discover">Discover opportunities</a> and apply.</li>
            <li>Accept terms to lock the fee and open a job.</li>
            <li>Submit your content and track reviews in <a href="/creator/jobs">My Jobs</a>.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

async function creatorDiscover(pc: PageContext): Promise<ReactNode> {
  const svc = pc.services.creator;
  const opps = svc.discoverOpportunities();
  return (
    <>
      <PageHeader title="Discover opportunities" description="Open content opportunities across participating businesses." />
      <Flash pc={pc} />
      {opps.length === 0 ? (
        <EmptyState title="No open opportunities" description="Check back soon." />
      ) : (
        <div className="pt-stack">
          {opps.map((o) => {
            const dels = svc.deliverablesFor(pc.request, o.id);
            const total = dels.reduce((n, d) => n + Number(d.payment.minorUnits), 0);
            return (
              <Card key={o.id} title={o.title}>
                <p style={{ color: tokens.color.textMuted }}>{o.description}</p>
                <DefinitionList items={[
                  { term: "Deliverables", value: dels.map((d) => titleCase(d.format)).join(", ") || "—" },
                  { term: "Pays up to", value: dels[0] ? moneyJson({ currency: dels[0].payment.currency, minorUnits: String(total) }) : "—" },
                  { term: "Eligibility", value: titleCase(o.eligibility) },
                ]} />
                <div style={{ marginTop: tokens.space.md }}>
                  <PostButton action={`/creator/opportunities/${o.id}/apply`} label="Apply" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function creatorJobs(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const apps = svc.myApplications(pc.request);
  const subs = svc.mySubmissions(pc.request);
  const subByOpp = new Map(subs.map((s) => [s.opportunityId, s]));
  return (
    <>
      <PageHeader title="My jobs" description="Applications, accepted terms, and submissions." />
      <Flash pc={pc} />
      {apps.length === 0 ? (
        <EmptyState title="No jobs yet" description="Apply from Discover to start a job." />
      ) : (
        <div className="pt-stack">
          {apps.map((a) => <JobCard key={a.id} pc={pc} app={a} submission={subByOpp.get(a.opportunityId)} />)}
        </div>
      )}
    </>
  );
}

function JobCard({ pc, app, submission }: { pc: PageContext; app: CreatorApplication; submission?: Submission }): JSX.Element {
  const opp = pc.services.creator.discoverOpportunities().find((o) => o.id === app.opportunityId);
  const dels = pc.services.creator.deliverablesFor(pc.request, app.opportunityId);
  const del = dels[0];
  return (
    <Card title={opp?.title ?? "Opportunity"}>
      <DefinitionList items={[
        { term: "Status", value: <StatusBadge status={app.status} /> },
        { term: "Fee", value: app.feeSnapshot ? `${(app.feeSnapshot.rateBps / 100).toFixed(2)}% (${app.feeSnapshot.payer}-paid)` : "not accepted yet" },
        { term: "Submission", value: submission ? <StatusBadge status={submission.status} /> : "none" },
      ]} />
      <div className="pt-row" style={{ marginTop: tokens.space.md, gap: tokens.space.sm }}>
        {(app.status === "applied" || app.status === "invited") && <PostButton action={`/creator/applications/${app.id}/accept`} label="Accept terms" />}
        {app.status === "accepted" && !submission && del && (
          <form method="post" action={`/creator/opportunities/${app.opportunityId}/submit`} className="pt-stack" style={{ width: "100%" }}>
            <input type="hidden" name="deliverableId" value={del.id} />
            <div className="pt-grid cols-2">
              <Field label="File name" htmlFor={`fn_${app.id}`}><Input id={`fn_${app.id}`} name="fileName" defaultValue="my-clip.mp4" /></Field>
              <Field label="Duration (s)" htmlFor={`du_${app.id}`}><Input id={`du_${app.id}`} name="durationSec" defaultValue="30" /></Field>
            </div>
            <input type="hidden" name="widthPx" value="1080" />
            <input type="hidden" name="heightPx" value="1920" />
            <input type="hidden" name="hasAudio" value="on" />
            <input type="hidden" name="hasCta" value="on" />
            <input type="hidden" name="language" value="en" />
            <Button type="submit" size="sm">Upload submission (demo)</Button>
          </form>
        )}
      </div>
      <DemoNote>Local demo storage — file metadata only; no real upload occurs.</DemoNote>
    </Card>
  );
}

async function creatorEarnings(pc: PageContext): Promise<ReactNode> {
  const balances = await pc.services.creator.myBalances(pc.request);
  return (
    <>
      <PageHeader title="Earnings" description="Derived from the append-only creator-payment ledger. Payouts are SIMULATED locally." />
      <Flash pc={pc} />
      {balances.length === 0 ? (
        <EmptyState title="No earnings yet" description="Approved deliverables appear here." />
      ) : (
        <div className="pt-grid cols-3">
          {balances.map((b) => (
            <Card key={b.currency} title={b.currency}>
              <DefinitionList items={[
                { term: "Pending", value: moneyJson(b.pending) },
                { term: "Paid", value: moneyJson(b.paid) },
                { term: "Reversed", value: moneyJson(b.reversed) },
              ]} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function creatorProfile(pc: PageContext): ReactNode {
  const profile = pc.services.creator.myProfile(pc.request);
  return (
    <>
      <PageHeader title="Profile" />
      <Flash pc={pc} />
      <Card title="Creator profile">
        {profile ? (
          <DefinitionList items={[
            { term: "Name", value: profile.displayName },
            { term: "Formats", value: profile.formats.map(titleCase).join(", ") || "—" },
            { term: "Platforms", value: profile.platforms.map(titleCase).join(", ") || "—" },
            { term: "Verification", value: profile.verification.toUpperCase() },
            { term: "Status", value: <StatusBadge status={profile.status} /> },
          ]} />
        ) : (
          <form method="post" action="/creator/profile" className="pt-stack">
            <Field label="Display name" htmlFor="dn"><Input id="dn" name="displayName" defaultValue="New Creator" /></Field>
            <Button type="submit">Create profile</Button>
          </form>
        )}
      </Card>
    </>
  );
}

// ==========================================================================
// Business "Creators" section (scope: /business/creators)
// ==========================================================================

export async function renderBusinessCreators(pc: PageContext): Promise<ReactNode> {
  const sub = pc.path.replace(/^\/business\/creators\/?/, "");
  switch (true) {
    case sub === "":
      return businessCreatorDashboard(pc);
    case sub === "opportunities":
      return businessOpportunities(pc);
    case sub === "submissions":
      return businessReviewQueue(pc);
    case sub === "payments":
      return businessPayments(pc);
    case sub === "library":
      return businessLibrary(pc);
    default:
      return <EmptyState title="Not found" description={`No page for “creators/${sub}”.`} />;
  }
}

function businessCreatorDashboard(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const opps = svc.listOpportunities(pc.request);
  const queue = svc.reviewQueue(pc.request);
  const payments = pc.ctx.can("creator_payment.authorize") ? svc.listPayments(pc.request) : [];
  const assets = pc.ctx.can("content_asset.manage") ? svc.listAssets(pc.request) : [];
  return (
    <>
      <PageHeader title="Creator dashboard" description="Recruit creators, review content, pay per approved deliverable, and distribute to affiliates." />
      <Flash pc={pc} />
      <div className="pt-grid cols-4">
        <StatTile label="Opportunities" value={opps.length} />
        <StatTile label="Awaiting review" value={queue.length} intent="warning" />
        <StatTile label="Payments" value={payments.length} intent="info" />
        <StatTile label="Library assets" value={assets.length} intent="success" />
      </div>
      <div style={{ marginTop: tokens.space.lg }}>
        <Card title="Quick links">
          <ul style={{ margin: 0, paddingLeft: tokens.space.lg }}>
            <li><a href="/business/creators/opportunities">Opportunities</a></li>
            <li><a href="/business/creators/submissions">Review queue</a> ({queue.length})</li>
            <li><a href="/business/creators/payments">Creator payments</a></li>
            <li><a href="/business/creators/library">Content library</a></li>
          </ul>
        </Card>
      </div>
    </>
  );
}

function businessOpportunities(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const opps = svc.listOpportunities(pc.request);
  const columns: Column<ContentOpportunity>[] = [
    { key: "title", header: "Title", render: (o) => o.title },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
    { key: "elig", header: "Eligibility", render: (o) => titleCase(o.eligibility) },
    { key: "dels", header: "Deliverables", render: (o) => svc.deliverablesFor(pc.request, o.id).map((d) => titleCase(d.format)).join(", ") },
    {
      key: "actions", header: "", align: "right",
      render: (o) => (o.status === "draft" && pc.ctx.can("content_opportunity.manage")
        ? <PostButton action={`/business/creators/opportunities/${o.id}/publish`} label="Publish" />
        : <span style={{ color: tokens.color.textMuted }}>—</span>),
    },
  ];
  return (
    <>
      <PageHeader title="Opportunities" description="Content opportunities in your creator program." />
      <Flash pc={pc} />
      <Card title="All opportunities">
        <Table columns={columns} rows={opps} getRowKey={(o) => o.id} emptyTitle="No opportunities yet" />
      </Card>
    </>
  );
}

function businessReviewQueue(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const queue = svc.reviewQueue(pc.request);
  return (
    <>
      <PageHeader title="Review queue" description="Human review. AI review is advisory; approval creates a payable but moves no money." />
      <Flash pc={pc} />
      {queue.length === 0 ? (
        <EmptyState title="Nothing to review" description="Approved and rejected submissions leave the queue." />
      ) : (
        <div className="pt-stack">
          {queue.map((s) => {
            const v = svc.versionsFor(pc.request, s.id).at(-1);
            return (
              <Card key={s.id} title={svc.creatorDisplayName(s.creatorId)}>
                <DefinitionList items={[
                  { term: "Submission", value: <StatusBadge status={s.status} /> },
                  { term: "File", value: v?.fileName ?? "—" },
                  { term: "Duration", value: v?.durationSec ? `${v.durationSec}s` : "—" },
                  { term: "Revisions used", value: String(s.revisionsUsed) },
                ]} />
                <div className="pt-row" style={{ marginTop: tokens.space.md, gap: tokens.space.sm }}>
                  {pc.ctx.can("submission.approve") && <PostButton action={`/business/creators/submissions/${s.id}/approve`} label="Approve" intent="success" />}
                  {pc.ctx.can("submission.request_revision") && <PostButton action={`/business/creators/submissions/${s.id}/revision`} label="Request revision" intent="neutral" variant="outline" />}
                  {pc.ctx.can("submission.reject") && <PostButton action={`/business/creators/submissions/${s.id}/reject`} label="Reject" intent="danger" variant="ghost" />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function businessPayments(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const payments = svc.listPayments(pc.request);
  const columns: Column<CreatorPayment>[] = [
    { key: "creator", header: "Creator", render: (p) => svc.creatorDisplayName(p.creatorId) },
    { key: "gross", header: "Gross", render: (p) => moneyJson(p.gross), align: "right" },
    { key: "reason", header: "Reason", render: (p) => titleCase(p.reason) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="pt-row" style={{ justifyContent: "flex-end", gap: tokens.space.xs }}>
          {p.status === "approved" && pc.ctx.can("creator_payment.authorize") && <PostButton action={`/business/creators/payments/${p.id}/authorize`} label="Authorize" />}
          {p.status === "scheduled" && pc.ctx.can("creator_payment.execute") && <PostButton action={`/business/creators/payments/${p.id}/execute`} label="Pay (sim)" intent="success" />}
          {p.status === "paid" && <Badge intent="success">paid (sim)</Badge>}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader title="Creator payments" description="Approve ≠ authorize ≠ execute. Fee is snapshot-locked; payouts are SIMULATED locally." />
      <Flash pc={pc} />
      <Card title="Payables"><Table columns={columns} rows={payments} getRowKey={(p) => p.id} emptyTitle="No payables yet" /></Card>
    </>
  );
}

function businessLibrary(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const items = svc.listAssets(pc.request);
  const subs = svc.listSubmissions(pc.request).filter((s) => s.status === "approved");
  const publishedVersionIds = new Set(items.map((i) => i.asset.sourceVersionId));
  const unpublished = subs.filter((s) => s.currentVersionId && !publishedVersionIds.has(s.currentVersionId));
  return (
    <>
      <PageHeader title="Content library" description="Approved content, its license, and affiliate-rank distribution." />
      <Flash pc={pc} />
      {unpublished.length > 0 && (
        <Card title="Approved, not yet published">
          <div className="pt-stack">
            {unpublished.map((s) => (
              <div key={s.id} className="pt-row" style={{ justifyContent: "space-between" }}>
                <span>{svc.creatorDisplayName(s.creatorId)} — submission {s.id}</span>
                {pc.ctx.can("content_asset.manage") && <PostButton action={`/business/creators/submissions/${s.id}/publish`} label="Publish to library" />}
              </div>
            ))}
          </div>
        </Card>
      )}
      <div style={{ marginTop: tokens.space.lg }}>
        <Card title="Published assets">
          {items.length === 0 ? <EmptyState title="No published assets" /> : (
            <div className="pt-stack">
              {items.map(({ asset, license }) => (
                <Card key={asset.id} title={asset.title}>
                  <DefinitionList items={[
                    { term: "Format", value: titleCase(asset.format) },
                    { term: "Status", value: <StatusBadge status={asset.status} /> },
                    { term: "License", value: license ? `${license.usageRights.map(titleCase).join(", ")} · ${license.status}` : "—" },
                    { term: "Creator", value: svc.creatorDisplayName(asset.creatorId) },
                  ]} />
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ==========================================================================
// Affiliate Content Library (scope: /affiliate/content)
// ==========================================================================

const DEMO_AFFILIATE_RANK: AffiliateRank = "gold";

export function renderAffiliateContent(pc: PageContext): ReactNode {
  const items = pc.services.creator.libraryForAffiliate(pc.request, DEMO_AFFILIATE_RANK);
  return (
    <>
      <PageHeader title="Content library" description="Approved marketing content unlocked by your affiliate rank." />
      <Flash pc={pc} />
      <Alert intent="info">Showing access for demo rank: <strong>{titleCase(DEMO_AFFILIATE_RANK)}</strong>. In production your rank comes from your affiliate tier.</Alert>
      <div style={{ marginTop: tokens.space.lg }}>
        {items.length === 0 ? (
          <EmptyState title="No content yet" description="Approved content published by businesses appears here." />
        ) : (
          <div className="pt-stack">
            {items.map(({ asset, license, decision }) => (
              <Card key={asset.id} title={asset.title}>
                <DefinitionList items={[
                  { term: "Format", value: titleCase(asset.format) },
                  { term: "Access", value: decision.granted ? <Badge intent="success">unlocked</Badge> : <Badge intent="neutral">locked</Badge> },
                  { term: decision.granted ? "License" : "To unlock", value: decision.granted ? (license ? `${license.usageRights.map(titleCase).join(", ")}` : "—") : (!decision.granted && decision.requiredRank ? `Reach ${titleCase(decision.requiredRank)}` : titleCase(!decision.granted ? decision.reason : "")) },
                ]} />
                {decision.granted && (
                  <div style={{ marginTop: tokens.space.sm }}>
                    <Button size="sm" variant="outline" disabled>Download (demo)</Button>
                    <DemoNote>Demo mode — no real signed download URL is minted.</DemoNote>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
