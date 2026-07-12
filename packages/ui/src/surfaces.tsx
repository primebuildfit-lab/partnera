import { type ReactNode } from "react";
import { type Intent, tokens } from "./tokens";
import { intentColor } from "./style-utils";

export interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}

export function Card({ title, actions, children, padded = true }: CardProps): JSX.Element {
  return (
    <section
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadow.sm,
        overflow: "hidden",
      }}
    >
      {title || actions ? (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${tokens.space.md} ${tokens.space.lg}`,
            borderBottom: `1px solid ${tokens.color.border}`,
          }}
        >
          <h3 style={{ margin: 0, fontSize: tokens.font.size.lg, fontWeight: tokens.font.weight.semibold, color: tokens.color.text }}>
            {title}
          </h3>
          {actions}
        </header>
      ) : null}
      <div style={{ padding: padded ? tokens.space.lg : 0 }}>{children}</div>
    </section>
  );
}

export interface AlertProps {
  intent?: Intent;
  title?: string;
  children: ReactNode;
}

/** Inline notification/callout. Toasts compose this same visual language. */
export function Alert({ intent = "info", title, children }: AlertProps): JSX.Element {
  const base = intentColor(intent);
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.space.xs,
        padding: tokens.space.md,
        borderRadius: tokens.radius.md,
        border: `1px solid ${base}`,
        borderLeft: `4px solid ${base}`,
        background: tokens.color.surfaceMuted,
        color: tokens.color.text,
      }}
    >
      {title ? <strong style={{ color: base }}>{title}</strong> : null}
      <span style={{ fontSize: tokens.font.size.sm }}>{children}</span>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Consistent empty/zero-data state so surfaces never render a blank void. */
export function EmptyState({ title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.space.sm,
        padding: tokens.space["3xl"],
        textAlign: "center",
        color: tokens.color.textMuted,
      }}
    >
      <strong style={{ color: tokens.color.text, fontSize: tokens.font.size.lg }}>{title}</strong>
      {description ? <p style={{ margin: 0, maxWidth: 420 }}>{description}</p> : null}
      {action}
    </div>
  );
}
