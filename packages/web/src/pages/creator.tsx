import { type ReactNode } from "react";
import { Alert, Badge, Button, Card, type Column, EmptyState, Field, Input, Table, tokens } from "@partnera/ui";
import {
  type AffiliateRank,
  type ContentOpportunity,
  type CreatorApplication,
  type CreatorPayment,
  type CreatorProgramId,
  type Submission,
  computeFee,
  paymentForCategory,
} from "@partnera/creator-marketplace";
import { Money } from "@partnera/core";
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
    case sub === "config":
      return businessProgramConfig(pc);
    case sub === "opportunities":
      return businessOpportunities(pc);
    case sub === "submissions":
      return businessReviewQueue(pc);
    case sub === "queue":
      return businessWaitingQueue(pc);
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
  const feeBps = 300; // provisional business-paid default (2–4% range)
  return (
    <>
      <PageHeader title="Review workspace" description="Two advisory AI scores; you confirm the category. Your program config sets the payment — AI never sets money, never moves money." />
      <Flash pc={pc} />
      <Alert intent="info">{CONFIG_NOTICE}</Alert>
      {queue.length === 0 ? (
        <EmptyState title="Nothing to review" description="Approved, rejected, and waiting submissions leave the active queue." />
      ) : (
        <div className="pt-stack" style={{ marginTop: tokens.space.lg }}>
          {queue.map((s) => {
            const v = svc.versionsFor(pc.request, s.id).at(-1);
            const rec = svc.recommendPreview(pc.request, s.id);
            const scheme = svc.schemeForSubmission(pc.request, s.id);
            return (
              <Card key={s.id} title={svc.creatorDisplayName(s.creatorId)}>
                <div className="pt-grid cols-2">
                  <div>
                    <strong style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>Media (demo preview)</strong>
                    <div style={{ height: 90, background: tokens.color.surfaceMuted ?? "#eee", borderRadius: tokens.radius.md, display: "flex", alignItems: "center", justifyContent: "center", color: tokens.color.textMuted, marginTop: 4 }}>▶ {v?.fileName ?? "clip"}</div>
                    <DefinitionList items={[
                      { term: "Duration", value: v?.durationSec ? `${v.durationSec}s` : "—" },
                      { term: "Audio / CTA", value: `${v?.hasAudio ? "audio" : "no audio"} · ${v?.hasCta ? "CTA" : "no CTA"}` },
                      { term: "Revisions used", value: String(s.revisionsUsed) },
                    ]} />
                  </div>
                  <div>
                    <strong style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>AI advisory (mock)</strong>
                    <DefinitionList items={[
                      { term: "Technical score", value: `${rec.technicalScore}/100` },
                      { term: "Commercial score", value: `${rec.commercialScore}/100` },
                      { term: "Confidence", value: `${Math.round(rec.confidence * 100)}%` },
                      { term: "Recommended", value: rec.recommendedCategoryKey ? titleCase(rec.recommendedCategoryKey) : "—" },
                      { term: "Strengths", value: rec.strengths.join(", ") || "—" },
                      { term: "Weaknesses", value: rec.weaknesses.join(", ") || "—" },
                    ]} />
                  </div>
                </div>
                {scheme && (
                  <div style={{ marginTop: tokens.space.md, overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: tokens.font.size.sm, borderCollapse: "collapse" }}>
                      <thead><tr style={{ textAlign: "left", color: tokens.color.textMuted }}><th>Category</th><th>Creator payment</th><th>Partnera fee ({(feeBps / 100).toFixed(0)}%)</th><th>Business total</th><th>Creator net</th></tr></thead>
                      <tbody>
                        {scheme.categories.filter((c) => c.active).map((c) => {
                          const p = paymentForCategory(scheme, c.key);
                          const gross = p.amount ? Money.fromJSON(p.amount) : Money.zero(c.currency);
                          const fee = computeFee(gross, { rateBps: feeBps, payer: "business", configVersion: 1, snapshotAt: new Date() });
                          return (
                            <tr key={c.key} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
                              <td>{c.name}</td>
                              <td>{p.payable ? moneyJson(gross.toJSON()) : "—"}</td>
                              <td>{p.payable ? moneyJson(fee.fee.toJSON()) : "—"}</td>
                              <td>{p.payable ? moneyJson(fee.businessCost.toJSON()) : "—"}</td>
                              <td>{p.payable ? moneyJson(fee.creatorNet.toJSON()) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {pc.ctx.can("submission.approve") && scheme && (
                  <form method="post" action={`/business/creators/submissions/${s.id}/review-scheme`} className="pt-row" style={{ marginTop: tokens.space.md, gap: tokens.space.sm, alignItems: "flex-end" }}>
                    <Field label="Confirm category" htmlFor={`cat_${s.id}`}>
                      <select id={`cat_${s.id}`} name="categoryKey" defaultValue={rec.recommendedCategoryKey ?? scheme.categories[0]?.key} style={{ padding: "6px 8px", borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}>
                        {scheme.categories.filter((c) => c.active).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                      </select>
                    </Field>
                    <Button type="submit" size="sm" intent="success">Confirm category</Button>
                  </form>
                )}
                <div className="pt-row" style={{ marginTop: tokens.space.sm, gap: tokens.space.sm }}>
                  {pc.ctx.can("submission.request_revision") && <PostButton action={`/business/creators/submissions/${s.id}/revision`} label="Request revision" intent="neutral" variant="outline" />}
                  {pc.ctx.can("submission.reject") && <PostButton action={`/business/creators/submissions/${s.id}/reject`} label="Reject (no retain)" intent="danger" variant="ghost" />}
                </div>
                <DemoNote>Confirming a category applies your configured payment and routes over-budget/over-capacity items to the waiting queue (never auto-rejected).</DemoNote>
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

const CONFIG_NOTICE = "Payments and evaluation categories are configured by this business. Partnera does not determine creator compensation — it charges a separate, transparent transaction fee (2%–4%).";

function businessProgramConfig(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const programs = svc.listPrograms(pc.request);
  const program = programs[0];
  if (!program) return <EmptyState title="No creator program yet" description="Create a program first." />;
  const programId = program.id as CreatorProgramId;
  const scheme = svc.getScheme(pc.request, programId);
  const budget = svc.getBudget(pc.request, programId);
  const exposure = svc.exposureFor(pc.request, programId);
  const columns: Column<(typeof scheme.categories)[number]>[] = [
    { key: "name", header: "Category", render: (c) => <Badge intent="neutral">{c.name}</Badge> },
    { key: "band", header: "Score band", render: (c) => `${c.minScore}–${c.maxScore}` },
    { key: "pay", header: "Payment", render: (c) => (c.payable ? moneyJson({ currency: c.currency, minorUnits: c.paymentMinor }) : "—"), align: "right" },
    { key: "lib", header: "Library", render: (c) => (c.libraryEligible ? "yes" : "no") },
    { key: "aff", header: "Affiliate", render: (c) => (c.affiliateEligible ? "yes" : "no") },
    {
      key: "edit", header: "Set payment", align: "right",
      render: (c) => (
        <form method="post" action={`/business/creators/config/category/${programId}`} className="pt-row" style={{ gap: tokens.space.xs, justifyContent: "flex-end" }}>
          <input type="hidden" name="categoryKey" value={c.key} />
          <Input name="paymentMajor" defaultValue={(Number(c.paymentMinor) / 100).toFixed(2)} style={{ width: 80 }} aria-label={`${c.name} payment`} />
          <Button type="submit" size="sm" variant="outline">Save</Button>
        </form>
      ),
    },
  ];
  return (
    <>
      <PageHeader title="Program setup" description="Your program's evaluation categories, payments, budget, and capacity — all yours to configure." />
      <Flash pc={pc} />
      <Alert intent="info">{CONFIG_NOTICE}</Alert>
      <div style={{ marginTop: tokens.space.lg }}>
        <Card title={`Evaluation categories — ${scheme.name}`}>
          <Table columns={columns} rows={scheme.categories} getRowKey={(c) => c.key} emptyTitle="No categories" />
          <DemoNote>A category maps a confirmed quality decision to the payment you set. AI recommends a category; it never sets the amount. One or more categories are supported.</DemoNote>
        </Card>
      </div>
      <div className="pt-grid cols-2" style={{ marginTop: tokens.space.lg }}>
        <Card title="Budget">
          {budget ? (
            <DefinitionList items={[
              { term: "Total", value: moneyJson({ currency: budget.currency, minorUnits: budget.totalMinor }) },
              { term: "Committed", value: exposure ? moneyJson(exposure.committed) : "—" },
              { term: "Paid (sim)", value: exposure ? moneyJson(exposure.paid) : "—" },
              { term: "Remaining", value: exposure ? moneyJson(exposure.remaining) : "—" },
              { term: "Projected Partnera fee", value: exposure ? moneyJson(exposure.projectedFee) : "—" },
              { term: "Projected total cost", value: exposure ? moneyJson(exposure.projectedTotalCost) : "—" },
            ]} />
          ) : <p style={{ color: tokens.color.textMuted }}>No budget set.</p>}
          <form method="post" action={`/business/creators/config/budget/${programId}`} className="pt-row" style={{ gap: tokens.space.xs, marginTop: tokens.space.md }}>
            <Field label="Total budget (USD)" htmlFor="tb"><Input id="tb" name="totalMajor" defaultValue={budget ? (Number(budget.totalMinor) / 100).toFixed(2) : "0"} style={{ width: 120 }} /></Field>
            <Button type="submit" size="sm" style={{ alignSelf: "flex-end" }}>Save budget</Button>
          </form>
        </Card>
        <Card title="Financial exposure before accepting more">
          <p style={{ color: tokens.color.textMuted }}>Over-budget or over-capacity content is never auto-rejected — it enters a waiting queue so you can decide.</p>
        </Card>
      </div>
    </>
  );
}

function businessWaitingQueue(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const items = svc.listDispositionsView(pc.request);
  const waiting = items.filter((i) => ["waiting_for_budget", "waiting_for_capacity", "shortlisted", "internal_only", "archived", "irrelevant"].includes(i.disposition.queueState));
  return (
    <>
      <PageHeader title="Waiting queue" description="Content awaiting budget/capacity, or retained for other uses. Honest statuses — nothing here is promised payment." />
      <Flash pc={pc} />
      {waiting.length === 0 ? (
        <EmptyState title="Queue empty" description="Items waiting for budget/capacity or retained internally appear here." />
      ) : (
        <div className="pt-stack">
          {waiting.map(({ disposition: d, creatorName }) => (
            <Card key={d.submissionId} title={creatorName}>
              <DefinitionList items={[
                { term: "Queue state", value: <StatusBadge status={d.queueState} /> },
                { term: "Category", value: d.categoryKey ? titleCase(d.categoryKey) : "—" },
                { term: "Would pay", value: d.paymentEligible && d.paymentMinor && d.currency ? moneyJson({ currency: d.currency, minorUnits: d.paymentMinor }) : "—" },
                { term: "Library", value: titleCase(d.libraryStatus) },
                { term: "Internal use", value: titleCase(d.internalUse) },
              ]} />
              <div className="pt-row" style={{ marginTop: tokens.space.md, gap: tokens.space.sm }}>
                {(d.queueState === "waiting_for_budget" || d.queueState === "waiting_for_capacity") && <PostButton action={`/business/creators/queue/${d.submissionId}/promote`} label="Promote to review" />}
                <PostButton action={`/business/creators/queue/${d.submissionId}/internal`} label="Keep internal" variant="outline" intent="neutral" />
                <PostButton action={`/business/creators/queue/${d.submissionId}/archive`} label="Archive" variant="ghost" intent="neutral" />
              </div>
            </Card>
          ))}
        </div>
      )}
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
