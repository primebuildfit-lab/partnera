import { type ReactNode } from "react";
import { tokens } from "@partnera/ui";
import { type AppScope, type WebContext } from "./auth";
import { navFor } from "./nav";

/**
 * The application shell: a responsive sidebar (desktop), collapsible menu
 * (mobile, native <details> — no JS), an app switcher, and the main content
 * region. Accessibility: a skip link, ARIA landmarks (banner/navigation/main),
 * `aria-current` on the active item, and keyboard-reachable links throughout.
 * Navigation items the principal lacks permission for are hidden.
 */
export function AppShell(props: {
  ctx: WebContext;
  scope: AppScope;
  currentPath: string;
  children: ReactNode;
}): JSX.Element {
  const nav = navFor(props.scope);
  return (
    <>
      <a href="#main" className="pt-skip">
        Skip to content
      </a>
      <div className="pt-topbar">
        <strong>Partnera</strong>
        <span style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.sm }}>
          {titleFor(props.scope)}
        </span>
      </div>
      <div className="pt-shell">
        <aside className="pt-sidebar" role="banner">
          <div style={{ display: "flex", alignItems: "center", gap: tokens.space.sm, padding: "4px 8px 12px" }}>
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: tokens.color.primary,
                display: "inline-block",
              }}
            />
            <strong style={{ fontSize: tokens.font.size.lg }}>Partnera</strong>
          </div>

          <AppSwitcher ctx={props.ctx} scope={props.scope} />

          <details className="pt-navwrap" open>
            <summary>Menu</summary>
            <nav className="pt-nav" aria-label="Primary">
              {nav.map((group) => {
                const visible = group.items.filter((i) => !i.permission || props.ctx.can(i.permission));
                if (visible.length === 0) return null;
                return (
                  <div className="pt-nav-group" key={group.title}>
                    <h4>{group.title}</h4>
                    {visible.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        aria-current={isCurrent(props.currentPath, item.href) ? "page" : undefined}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                );
              })}
            </nav>
          </details>

          <SessionBox ctx={props.ctx} scope={props.scope} />
        </aside>

        <main id="main" className="pt-main">
          {props.children}
        </main>
      </div>
    </>
  );
}

function AppSwitcher({ ctx, scope }: { ctx: WebContext; scope: AppScope }): JSX.Element {
  const scopes: { key: AppScope; label: string; href: string; show: boolean }[] = [
    { key: "business", label: "Business", href: "/business", show: true },
    { key: "affiliate", label: "Affiliate", href: "/affiliate", show: true },
    {
      key: "creator",
      label: "Creator",
      href: "/creator",
      show: scope === "creator" || ctx.can("creator.self"),
    },
    {
      key: "admin",
      label: "Admin",
      href: "/admin",
      show: ctx.session.isPlatformOperator || ctx.can("platform.health.read"),
    },
  ];
  return (
    <div
      className="pt-row"
      role="navigation"
      aria-label="Switch app"
      style={{ gap: tokens.space.xs, marginBottom: tokens.space.md }}
    >
      {scopes
        .filter((s) => s.show)
        .map((s) => (
          <a
            key={s.key}
            href={s.href}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 8px",
              borderRadius: tokens.radius.md,
              fontSize: tokens.font.size.sm,
              border: `1px solid ${tokens.color.border}`,
              background: s.key === scope ? tokens.color.primary : "transparent",
              color: s.key === scope ? tokens.color.primaryText : tokens.color.text,
            }}
          >
            {s.label}
          </a>
        ))}
    </div>
  );
}

function SessionBox({ ctx, scope }: { ctx: WebContext; scope: AppScope }): JSX.Element {
  return (
    <div
      style={{
        marginTop: tokens.space.xl,
        paddingTop: tokens.space.md,
        borderTop: `1px solid ${tokens.color.border}`,
        fontSize: tokens.font.size.sm,
      }}
    >
      <div style={{ color: tokens.color.text, fontWeight: tokens.font.weight.medium }}>
        {ctx.session.displayName}
      </div>
      <div style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.xs }}>{ctx.session.email}</div>
      <div style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.xs, marginTop: tokens.space.xs }}>
        {ctx.session.isPlatformOperator ? "Platform operator" : "Tenant member"} · {scope}
      </div>
      <a href="/logout" style={{ display: "inline-block", marginTop: tokens.space.sm, fontSize: tokens.font.size.sm }}>
        Log out
      </a>
    </div>
  );
}

function titleFor(scope: AppScope): string {
  switch (scope) {
    case "business":
      return "Business Dashboard";
    case "affiliate":
      return "Affiliate Portal";
    case "creator":
      return "Creator Portal";
    case "admin":
      return "Admin Console";
  }
}

function isCurrent(currentPath: string, href: string): boolean {
  if (href.endsWith("/business") || href.endsWith("/affiliate") || href.endsWith("/admin")) {
    return currentPath === href;
  }
  return currentPath === href || currentPath.startsWith(href + "/");
}
