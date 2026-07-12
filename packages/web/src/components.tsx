import { type ReactNode } from "react";
import { Badge, tokens } from "@partnera/ui";
import { type Intent } from "@partnera/ui";
import { type WebContext } from "./auth";
import { type PermissionKey } from "@partnera/auth";

/**
 * Presentation components layered on @partnera/ui — the reusable visual system
 * for the apps (Part 6). Nothing here holds business logic; they render
 * view-models. Cards, tables, forms, badges, empty/alert states come straight
 * from @partnera/ui and are not re-implemented.
 */

/** Page header with a title, optional description, and right-aligned actions. */
export function PageHeader(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: tokens.space.lg,
        marginBottom: tokens.space.xl,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: tokens.font.size["2xl"], color: tokens.color.text }}>
          {props.title}
        </h1>
        {props.description ? (
          <p style={{ margin: `${tokens.space.xs} 0 0`, color: tokens.color.textMuted }}>
            {props.description}
          </p>
        ) : null}
      </div>
      {props.actions ? <div className="pt-row">{props.actions}</div> : null}
    </header>
  );
}

/** A KPI stat tile: big value, label, optional sub-note and intent accent. */
export function StatTile(props: {
  label: string;
  value: ReactNode;
  note?: string;
  intent?: Intent;
}): JSX.Element {
  const accent = props.intent ?? "primary";
  return (
    <div
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.lg,
        padding: tokens.space.lg,
        borderTop: `3px solid var(--pt-color-${accent === "neutral" ? "border" : accent})`,
      }}
    >
      <div style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.sm }}>{props.label}</div>
      <div
        style={{
          fontSize: tokens.font.size["2xl"],
          fontWeight: tokens.font.weight.bold,
          color: tokens.color.text,
          marginTop: tokens.space.xs,
        }}
      >
        {props.value}
      </div>
      {props.note ? (
        <div style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.xs, marginTop: tokens.space.xs }}>
          {props.note}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_INTENT: Readonly<Record<string, Intent>> = {
  // commissions
  pending: "warning",
  held: "warning",
  approved: "info",
  paid: "success",
  reversed: "danger",
  rejected: "neutral",
  // offers / generic
  draft: "neutral",
  active: "success",
  paused: "warning",
  archived: "neutral",
  // payouts
  requested: "info",
  executing: "info",
  failed: "danger",
  canceled: "neutral",
  // fraud
  open: "danger",
  in_review: "warning",
  resolved: "success",
  low: "success",
  medium: "warning",
  high: "danger",
};

/** A status pill that maps a domain state string to a consistent colour. */
export function StatusBadge({ status }: { status: string }): JSX.Element {
  return <Badge intent={STATUS_INTENT[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

/** Two-column definition list for record detail views. */
export function DefinitionList({
  items,
}: {
  items: readonly { term: string; value: ReactNode }[];
}): JSX.Element {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: `${tokens.space.sm} ${tokens.space.lg}`, margin: 0 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.sm }}>{it.term}</dt>
          <dd style={{ margin: 0, color: tokens.color.text }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Render children only if the principal holds the permission (else a note). */
export function PermissionGate(props: {
  ctx: WebContext;
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}): JSX.Element {
  if (props.ctx.can(props.permission)) return <>{props.children}</>;
  return (
    <>
      {props.fallback ?? (
        <p style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.sm }}>
          You don’t have permission to view this ({props.permission}).
        </p>
      )}
    </>
  );
}

/**
 * A minimal, dependency-free horizontal bar chart (SVG). Accessible: each bar
 * has a title; the whole chart has an aria-label. Values are non-negative.
 */
export function BarChart(props: {
  label: string;
  data: readonly { label: string; value: number; display?: string }[];
  intent?: Intent;
}): JSX.Element {
  const max = Math.max(1, ...props.data.map((d) => d.value));
  const rowH = 26;
  const width = 480;
  const labelW = 130;
  const barMax = width - labelW - 60;
  const color = `var(--pt-color-${props.intent ?? "primary"})`;
  return (
    <svg
      viewBox={`0 0 ${width} ${Math.max(rowH, props.data.length * rowH)}`}
      role="img"
      aria-label={props.label}
      style={{ width: "100%", maxWidth: width, height: "auto" }}
    >
      {props.data.map((d, i) => {
        const w = Math.round((d.value / max) * barMax);
        const y = i * rowH;
        return (
          <g key={i}>
            <text x={0} y={y + 17} fontSize={12} fill={tokens.color.textMuted}>
              {d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label}
            </text>
            <rect x={labelW} y={y + 6} width={Math.max(2, w)} height={14} rx={3} fill={color}>
              <title>{`${d.label}: ${d.display ?? d.value}`}</title>
            </rect>
            <text x={labelW + Math.max(2, w) + 6} y={y + 17} fontSize={12} fill={tokens.color.text}>
              {d.display ?? d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
