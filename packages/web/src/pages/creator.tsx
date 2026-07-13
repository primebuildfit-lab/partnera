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
import { PageHeader, StatTile, StatusBadge, DefinitionList, ConfirmButton } from "../components";
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

/** A text link that performs a POST (for low-emphasis actions like dismiss/reopen). */
function PostLink(props: { action: string; label: string }): JSX.Element {
  return (
    <form method="post" action={props.action} style={{ display: "inline" }}>
      <button type="submit" style={{ background: "none", border: "none", padding: 0, color: tokens.color.primary, cursor: "pointer", font: "inherit", textDecoration: "underline" }}>{props.label}</button>
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
      <PageHeader title="Earnings" description="Your approved payments and payout status. Payouts are SIMULATED in local mode — no real money moves." />
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
    case sub === "setup":
      return businessSetupGuide(pc);
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

interface ChecklistStep { label: string; done: boolean; href: string }

function firstRunChecklist(pc: PageContext, steps: readonly ChecklistStep[]): ReactNode {
  const dismissed = pc.cookies?.["pt_cm_checklist"] === "off";
  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) {
    return (
      <p style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted, marginBottom: tokens.space.md }}>
        {doneCount === steps.length ? "Setup complete. " : "Setup checklist hidden. "}
        <PostLink action="/business/creators/checklist/on" label={doneCount === steps.length ? "Show checklist" : "Reopen checklist"} />
      </p>
    );
  }
  return (
    <div style={{ marginBottom: tokens.space.lg }}>
      <Card title={`Get started — ${doneCount}/${steps.length} done`}>
        <ol style={{ margin: 0, paddingLeft: tokens.space.lg, display: "grid", gap: tokens.space.xs }}>
          {steps.map((s) => (
            <li key={s.label} style={{ color: s.done ? tokens.color.textMuted : tokens.color.text }}>
              {s.done ? "✓ " : "○ "}
              <a href={s.href}>{s.label}</a>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: tokens.space.md }}>
          <PostLink action="/business/creators/checklist/off" label="Dismiss checklist" />
        </div>
      </Card>
    </div>
  );
}

function businessCreatorDashboard(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const opps = svc.listOpportunities(pc.request);
  const openOpps = opps.filter((o) => o.status === "open").length;
  const queue = svc.reviewQueue(pc.request);
  const canManage = pc.ctx.can("creator_program.manage");
  const program = canManage ? svc.listPrograms(pc.request)[0] : undefined;
  const scheme = program ? svc.getScheme(pc.request, program.id as CreatorProgramId) : null;
  const capacity = program ? svc.getCapacity(pc.request, program.id as CreatorProgramId) : null;
  const budget = program ? svc.getBudget(pc.request, program.id as CreatorProgramId) : null;
  const exposure = program && budget ? svc.exposureFor(pc.request, program.id as CreatorProgramId) : null;
  const dispositions = pc.ctx.can("submission.review") ? svc.listDispositionsView(pc.request) : [];
  const waitingBudget = dispositions.filter((d) => d.disposition.queueState === "waiting_for_budget").length;
  const waitingCapacity = dispositions.filter((d) => d.disposition.queueState === "waiting_for_capacity").length;
  const payments = pc.ctx.can("creator_payment.authorize") ? svc.listPayments(pc.request) : [];
  const assets = pc.ctx.can("content_asset.manage") ? svc.listAssets(pc.request) : [];
  const publishedVersions = new Set(assets.map((a) => a.asset.sourceVersionId));
  const awaitingPublication = pc.ctx.can("content_asset.manage")
    ? svc.listSubmissions(pc.request).filter((s) => s.status === "approved" && s.currentVersionId && !publishedVersions.has(s.currentVersionId)).length
    : 0;

  const schemeConfigured = !!scheme && (scheme.name !== "Default" || scheme.categories.length > 1);
  const hasPayableCategory = !!scheme && scheme.categories.some((c) => c.payable && BigInt(c.paymentMinor) > 0n);
  const steps: ChecklistStep[] = [
    { label: "Review your Creator Program", done: !!program, href: "/business/creators/config" },
    { label: "Confirm evaluation category names", done: schemeConfigured, href: "/business/creators/config" },
    { label: "Confirm category payments", done: hasPayableCategory, href: "/business/creators/config" },
    { label: "Set the content acceptance limit", done: !!capacity, href: "/business/creators/config" },
    { label: "Set the content budget", done: !!budget, href: "/business/creators/config" },
    { label: "Publish an opportunity", done: openOpps > 0, href: "/business/creators/opportunities" },
    { label: "Review the waiting queue", done: waitingBudget + waitingCapacity === 0, href: "/business/creators/queue" },
    { label: "Review submissions & decide", done: payments.length > 0, href: "/business/creators/submissions" },
    { label: "Publish approved content to the library", done: assets.length > 0, href: "/business/creators/library" },
  ];

  return (
    <>
      <PageHeader title="Creators" description="Recruit creators, review content, pay per approved deliverable, and share approved content with affiliates." actions={<a href="/business/creators/setup" style={{ fontSize: tokens.font.size.sm }}>Open setup guide →</a>} />
      <Flash pc={pc} />
      {canManage && firstRunChecklist(pc, steps)}
      <div className="pt-grid cols-4">
        <StatTile label="Awaiting review" value={queue.length} intent="warning" note="Submissions to decide" />
        <StatTile label="Waiting on budget / capacity" value={waitingBudget + waitingCapacity} intent={waitingBudget + waitingCapacity > 0 ? "warning" : "neutral"} note="Never auto-rejected" />
        <StatTile label="Budget remaining" value={exposure ? moneyJson(exposure.remaining) : budget ? "—" : "Not set"} intent="info" note="Before accepting more" />
        <StatTile label="Awaiting publication" value={awaitingPublication} intent="success" note="Approved, not yet shared" />
      </div>
      <div className="pt-grid cols-2" style={{ marginTop: tokens.space.lg }}>
        <Card title="Today's work">
          <ul style={{ margin: 0, paddingLeft: tokens.space.lg, display: "grid", gap: 4 }}>
            <li><a href="/business/creators/submissions">Reviews</a> — {queue.length} awaiting</li>
            <li><a href="/business/creators/queue">Queue</a> — {waitingBudget} on budget, {waitingCapacity} on capacity</li>
            <li><a href="/business/creators/payments">Payments</a> — {payments.length} payables</li>
            <li><a href="/business/creators/library">Content Library</a> — {assets.length} shared, {awaitingPublication} to publish</li>
          </ul>
        </Card>
        <Card title="Program">
          <DefinitionList items={[
            { term: "Opportunities open", value: String(openOpps) },
            { term: "Categories", value: scheme ? String(scheme.categories.length) : "—" },
            { term: "Acceptance limit", value: capacity?.maxAccepted != null ? String(capacity.maxAccepted) : "No limit" },
            { term: "Budget", value: budget ? moneyJson({ currency: budget.currency, minorUnits: budget.totalMinor }) : "Not set" },
          ]} />
          <div style={{ marginTop: tokens.space.sm }}><a href="/business/creators/config" style={{ fontSize: tokens.font.size.sm }}>Edit program →</a></div>
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

/** The four-line money breakdown every simulated payment shows (Part 10). */
function moneyBreakdown(grossJson: CreatorPayment["gross"], feeBps = 300): ReactNode {
  const gross = Money.fromJSON(grossJson);
  const fee = computeFee(gross, { rateBps: feeBps, payer: "business", configVersion: 1, snapshotAt: new Date() });
  return (
    <DefinitionList items={[
      { term: "Creator payment", value: moneyJson(gross.toJSON()) },
      { term: `Partnera fee (${(feeBps / 100).toFixed(0)}%)`, value: moneyJson(fee.fee.toJSON()) },
      { term: "Business total", value: <strong>{moneyJson(fee.businessCost.toJSON())}</strong> },
      { term: "Creator receives", value: moneyJson(fee.creatorNet.toJSON()) },
    ]} />
  );
}

function businessPayments(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const payments = svc.listPayments(pc.request);
  return (
    <>
      <PageHeader title="Creator payments" description="Confirm each step deliberately. The business pays a separate, transparent Partnera fee. Payouts are SIMULATED — no real money moves." />
      <Flash pc={pc} />
      <Alert intent="info">Every payout here is <strong>simulated</strong> in local mode. No real money moves and no payment provider is connected.</Alert>
      {payments.length === 0 ? (
        <div style={{ marginTop: tokens.space.lg }}>
          <EmptyState title="No creator payments yet" description="Confirm a category in Reviews to create a payable, then authorize it here." />
        </div>
      ) : (
        <div className="pt-stack" style={{ marginTop: tokens.space.lg }}>
          {payments.map((p) => (
            <Card key={p.id} title={svc.creatorDisplayName(p.creatorId)}>
              <div className="pt-grid cols-2">
                <div>
                  {moneyBreakdown(p.gross)}
                  <div style={{ marginTop: tokens.space.sm, fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>
                    Reason: {titleCase(p.reason)} · Status: <StatusBadge status={p.status} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: tokens.space.sm }}>
                  {p.status === "approved" && pc.ctx.can("creator_payment.authorize") && (
                    <ConfirmButton action={`/business/creators/payments/${p.id}/authorize`} summaryLabel="Authorize payment…" confirmLabel={`Confirm — authorize ${moneyJson(p.gross)} (simulated)`} details={<span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>Authorizing recognises the fee and schedules the payout. Simulated — no money moves.</span>} />
                  )}
                  {p.status === "scheduled" && pc.ctx.can("creator_payment.execute") && (
                    <ConfirmButton action={`/business/creators/payments/${p.id}/execute`} summaryLabel="Pay now…" confirmLabel={`Confirm — pay ${moneyJson(p.gross)} (simulated)`} intent="success" details={<span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>Marks the payout paid. Simulated — no money leaves any account.</span>} />
                  )}
                  {p.status === "paid" && <Badge intent="success">Paid — simulated (no money moved)</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
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
                <span>{svc.creatorDisplayName(s.creatorId)} — approved content</span>
                {pc.ctx.can("content_asset.manage") && <ConfirmButton action={`/business/creators/submissions/${s.id}/publish`} summaryLabel="Publish to library…" confirmLabel="Confirm — publish to affiliate library" details={<span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>This makes the content available to affiliates per your rank rules and its license.</span>} />}
              </div>
            ))}
          </div>
        </Card>
      )}
      <div style={{ marginTop: tokens.space.lg }}>
        <Card title="Published assets">
          {items.length === 0 ? <EmptyState title="No published assets yet" description="Approve content in Reviews, then publish it here to share with affiliates by rank." /> : (
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

function businessSetupGuide(pc: PageContext): ReactNode {
  const svc = pc.services.creator;
  const program = svc.listPrograms(pc.request)[0];
  const scheme = program ? svc.getScheme(pc.request, program.id as CreatorProgramId) : null;
  const capacity = program ? svc.getCapacity(pc.request, program.id as CreatorProgramId) : null;
  const budget = program ? svc.getBudget(pc.request, program.id as CreatorProgramId) : null;
  const openOpps = svc.listOpportunities(pc.request).filter((o) => o.status === "open").length;
  const steps = [
    { n: 1, title: "Program identity", done: !!program, body: "Name your creator program and describe what you're looking for.", href: "/business/creators/config", cta: "Open program" },
    { n: 2, title: "Content types", done: openOpps > 0, body: "Decide which content formats you want (via opportunities).", href: "/business/creators/opportunities", cta: "Opportunities" },
    { n: 3, title: "Evaluation categories", done: !!scheme && scheme.categories.length > 0, body: "Your own quality tiers (e.g. Rejected / Acceptable / Good / Excellent). One or more — your choice.", href: "/business/creators/config", cta: "Edit categories" },
    { n: 4, title: "Payments per category", done: !!scheme && scheme.categories.some((c) => c.payable && BigInt(c.paymentMinor) > 0n), body: "Set what each category pays. These are YOUR amounts — Partnera never sets them.", href: "/business/creators/config", cta: "Set payments" },
    { n: 5, title: "Acceptance limits", done: !!capacity, body: "Cap how much content you'll accept. Over-limit content waits — it's never auto-rejected.", href: "/business/creators/config", cta: "Set limits" },
    { n: 6, title: "Budget", done: !!budget, body: "Set your content budget. You'll always see exposure before accepting more.", href: "/business/creators/config", cta: "Set budget" },
    { n: 7, title: "Review method", done: true, body: "Human review with two advisory AI scores. AI recommends a category; you confirm it and your config sets the pay.", href: "/business/creators/submissions", cta: "Reviews" },
    { n: 8, title: "Content rights", done: true, body: "Usage rights and license duration are set per opportunity.", href: "/business/creators/opportunities", cta: "Opportunities" },
    { n: 9, title: "Affiliate-library rules", done: true, body: "Approved content is shared with affiliates by rank.", href: "/business/creators/library", cta: "Content Library" },
    { n: 10, title: "Preview & go", done: openOpps > 0, body: "Publish an opportunity and start receiving submissions.", href: "/business/creators/opportunities", cta: "Publish" },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <>
      <PageHeader title="Creator Program setup" description={`A quick guided path to a working program. ${done}/${steps.length} steps done.`} actions={<a href="/business/creators" style={{ fontSize: tokens.font.size.sm }}>← Back to Creators</a>} />
      <Flash pc={pc} />
      <Alert intent="info">{CONFIG_NOTICE}</Alert>
      <div className="pt-stack" style={{ marginTop: tokens.space.lg }}>
        {steps.map((s) => (
          <Card key={s.n} title={`${s.done ? "✓" : s.n}. ${s.title}`}>
            <div className="pt-row" style={{ justifyContent: "space-between", alignItems: "center", gap: tokens.space.md, flexWrap: "wrap" }}>
              <p style={{ margin: 0, color: tokens.color.textMuted, maxWidth: 560 }}>{s.body}</p>
              <a href={s.href}><Button size="sm" variant={s.done ? "outline" : "solid"}>{s.cta}</Button></a>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

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
