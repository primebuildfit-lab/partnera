import { type ReactNode } from "react";
import { type PageContext } from "../page";
import { moneyJson } from "../format";

/**
 * Partnera Internal OS — the private platform-operator console (Phase 8). Total
 * separation from the Business/Creator/Affiliate portals: its own dark layout,
 * its own routes (`/internal/*`), guarded to platform operators only (enforced in
 * app.tsx). Data comes from the platform service (two separate money books:
 * Revenue = Bank A, Vault = Bank B — never commingled).
 */

// ---- Design tokens (dark, violet accent — Partnera identity, not Shopify) ----
const T = {
  bg: "#0f1016", panel: "#171826", panel2: "#1e2033", border: "#2a2c42",
  text: "#e8e9f0", muted: "#9a9cb8", accent: "#7c5cff", accent2: "#a78bfa",
  ok: "#22c55e", warn: "#f59e0b", danger: "#ef4444", info: "#38bdf8",
};

const NAV: { group: string; items: { label: string; href: string; badge?: number }[] }[] = [
  { group: "General", items: [
    { label: "Inicio", href: "/internal" },
    { label: "Historial global", href: "/internal/activity" },
    { label: "Calendario Eventra", href: "/internal/eventra" },
    { label: "Ofertas", href: "/internal/offers" },
    { label: "Órdenes de contenido", href: "/internal/content-orders" },
    { label: "Analítica", href: "/internal/analytics" },
  ]},
  { group: "Gestión", items: [
    { label: "Empresas", href: "/internal/companies" },
    { label: "Usuarios y equipos", href: "/internal/users" },
    { label: "Creadores", href: "/internal/creators" },
    { label: "Afiliados", href: "/internal/affiliates" },
    { label: "Planes y membresías", href: "/internal/plans" },
    { label: "Ingresos Partnera", href: "/internal/finance/revenue" },
    { label: "Partnera Vault", href: "/internal/finance/vault" },
  ]},
  { group: "Operaciones", items: [
    { label: "Integraciones", href: "/internal/integrations" },
    { label: "IA y modelos", href: "/internal/ai" },
    { label: "Automatizaciones", href: "/internal/automations" },
  ]},
  { group: "Soporte y control", items: [
    { label: "Alertas", href: "/internal/alerts" },
    { label: "Auditoría", href: "/internal/audit" },
    { label: "Salud del sistema", href: "/internal/health" },
  ]},
  { group: "Configuración", items: [
    { label: "Ajustes", href: "/internal/settings" },
    { label: "Roles y permisos", href: "/internal/roles" },
  ]},
];

function InternalShell(props: { pc: PageContext; children: ReactNode; active: string }): JSX.Element {
  const name = props.pc.ctx.session.displayName;
  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "grid", gridTemplateColumns: "244px 1fr", fontFamily: "system-ui, sans-serif" }}>
      <aside style={{ background: T.panel, borderRight: `1px solid ${T.border}`, padding: "14px 10px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 14px" }}>
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: 7, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, display: "inline-block" }} />
          <strong style={{ fontSize: 15 }}>Partnera</strong>
          <span style={{ fontSize: 10, color: T.accent2, border: `1px solid ${T.border}`, borderRadius: 5, padding: "1px 5px" }}>Internal OS</span>
        </div>
        <nav aria-label="Internal OS">
          {NAV.map((g) => (
            <div key={g.group} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, padding: "6px 8px" }}>{g.group}</div>
              {g.items.map((it) => {
                const active = props.active === it.href;
                return (
                  <a key={it.href} href={it.href} aria-current={active ? "page" : undefined}
                     style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", borderRadius: 8, fontSize: 13,
                              color: active ? "#fff" : T.text, background: active ? T.accent : "transparent", textDecoration: "none", marginBottom: 1 }}>
                    <span>{it.label}</span>
                    {it.badge ? <span style={{ fontSize: 11, background: T.danger, color: "#fff", borderRadius: 10, padding: "0 6px" }}>{it.badge}</span> : null}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, background: T.panel, position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ fontSize: 13, color: T.muted }}>Panel privado de plataforma · solo operadores Partnera</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <span style={{ color: T.muted }}>{name}</span>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: T.ok, display: "inline-block" }} title="Operativo" />
            <a href="/logout" style={{ color: T.accent2, fontSize: 12 }}>Salir</a>
          </div>
        </header>
        <main id="main" style={{ padding: 20, maxWidth: 1240 }}>{props.children}</main>
      </div>
    </div>
  );
}

function metricCard(label: string, value: ReactNode, note?: ReactNode, accent = T.accent): JSX.Element {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderTop: `3px solid ${accent}`, borderRadius: 12, padding: 16 }}>
      <div style={{ color: T.muted, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {note ? <div style={{ color: T.muted, fontSize: 12, marginTop: 6 }}>{note}</div> : null}
    </div>
  );
}

/** Access-denied page for non-operators (returned with 403). */
export function internalAccessDenied(): JSX.Element {
  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontSize: 20 }}>Acceso restringido</h1>
        <p style={{ color: T.muted }}>El Partnera Internal OS es exclusivo para operadores de plataforma. Tu cuenta no tiene ese permiso.</p>
        <a href="/logout" style={{ color: T.accent2 }}>Cerrar sesión</a>
      </div>
    </div>
  );
}

export async function renderInternal(pc: PageContext): Promise<JSX.Element> {
  const sub = pc.path.replace(/^\/internal\/?/, "");
  const active = "/" + ["internal", ...sub.split("/").filter(Boolean).slice(0, 2)].join("/").replace(/\/$/, "");
  let body: ReactNode;
  switch (true) {
    case sub === "": body = home(pc); break;
    case sub === "companies": body = companies(pc); break;
    case sub.startsWith("finance/revenue"): body = revenuePage(pc); break;
    case sub.startsWith("finance/vault"): body = vaultPage(pc); break;
    case sub === "alerts": body = alertsPage(pc); break;
    case sub === "health": body = healthPage(pc); break;
    default: body = placeholder(sub); break;
  }
  return <InternalShell pc={pc} active={active}>{body}</InternalShell>;
}

// ---- Home (operative center §6) ----
function home(pc: PageContext): ReactNode {
  const s = pc.services.platform.homeSummary(pc.request);
  const rev = s.revenue;
  const vault = s.vault;
  return (
    <>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Centro operativo</h1>
      <p style={{ color: T.muted, margin: "0 0 18px" }}>Estado en vivo de la plataforma. Dinero simulado (sin custodia real).</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {metricCard("Empresas activas", s.businesses, "Total en la plataforma")}
        {metricCard("Usuarios activos", s.users.total, `Creadores ${s.users.creators} · Afiliados ${s.users.affiliates} · Empresas ${s.users.businessMembers}`, T.info)}
        {metricCard("Órdenes de contenido", s.contentOrders, `${s.submissionsAwaitingReview} submissions en revisión`, T.accent2)}
        {metricCard("Ingresos Partnera (Banco A)", moneyJson(rev.available), `Bruto ${moneyJson(rev.gross)} · reservado ${moneyJson(rev.reserved)}`, T.ok)}
        {metricCard("Partnera Vault (Banco B)", moneyJson(vault.held), `Disponible ${moneyJson(vault.available)} · comprometido ${moneyJson(vault.committed)}`, T.warn)}
        {metricCard("Alertas abiertas", s.openAlerts, s.openAlerts > 0 ? "Requieren atención" : "Sin pendientes", s.openAlerts > 0 ? T.danger : T.muted)}
      </div>

      <div style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
        <strong>Separación contable</strong>
        <p style={{ color: T.muted, fontSize: 13, margin: "6px 0 0" }}>
          <b>Dinero administrado</b> (Vault): {moneyJson(vault.held)} — fondos de terceros, no es ingreso de Partnera y no puede gastarse.
          &nbsp;·&nbsp; <b>Ingresos Partnera</b> (Revenue): {moneyJson(rev.available)} disponible. Los dos libros nunca se mezclan.
        </p>
        <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
          <a href="/internal/finance/revenue" style={{ color: T.accent2, fontSize: 13 }}>Ver ingresos →</a>
          <a href="/internal/finance/vault" style={{ color: T.accent2, fontSize: 13 }}>Ver Vault →</a>
        </div>
      </div>
      {alertsPreview(pc)}
    </>
  );
}

function alertsPreview(pc: PageContext): ReactNode {
  const open = pc.services.platform.openAlerts(pc.request).slice(0, 6);
  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Alertas críticas</h2>
      {open.length === 0 ? (
        <p style={{ color: T.muted, fontSize: 13 }}>Sin alertas abiertas.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {open.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", background: T.panel, border: `1px solid ${T.border}`, borderLeft: `3px solid ${a.severity === "critical" ? T.danger : a.severity === "warning" ? T.warn : T.info}`, borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 13 }}><b style={{ textTransform: "uppercase", fontSize: 10, color: T.muted }}>{a.category}</b> · {a.title}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Finance pages (two separate books) ----
function moneyRow(label: string, v: string): ReactNode {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ color: T.muted, fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{moneyJson({ currency: JSON.parse(v).currency, minorUnits: JSON.parse(v).minorUnits })}</span>
    </div>
  );
}
function revenuePage(pc: PageContext): ReactNode {
  const b = pc.services.platform.revenueBalance(pc.request);
  return (
    <>
      <h1 style={{ fontSize: 20 }}>Ingresos Partnera — Banco A</h1>
      <p style={{ color: T.muted }}>Dinero propiedad de Partnera. Append-only; balances derivados.</p>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, maxWidth: 520 }}>
        {moneyRow("Bruto reconocido", JSON.stringify(b.gross))}
        {moneyRow("Devoluciones", JSON.stringify(b.refunded))}
        {moneyRow("Reversas", JSON.stringify(b.reversed))}
        {moneyRow("Reservado", JSON.stringify(b.reserved))}
        {moneyRow("Retirado", JSON.stringify(b.withdrawn))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
          <strong>Disponible</strong><strong style={{ color: T.ok }}>{moneyJson(b.available)}</strong>
        </div>
      </div>
    </>
  );
}
function vaultPage(pc: PageContext): ReactNode {
  const b = pc.services.platform.vaultBalance(pc.request);
  return (
    <>
      <h1 style={{ fontSize: 20 }}>Partnera Vault — Banco B</h1>
      <p style={{ color: T.muted }}>Fondos de terceros administrados. <b>No es ingreso.</b> No puede usarse para gastos de Partnera.</p>
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, maxWidth: 520 }}>
        {moneyRow("Depositado", JSON.stringify(b.deposited))}
        {moneyRow("Comprometido", JSON.stringify(b.committed))}
        {moneyRow("Reservado", JSON.stringify(b.reserved))}
        {moneyRow("En disputa", JSON.stringify(b.disputed))}
        {moneyRow("Pagado", JSON.stringify(b.paidOut))}
        {moneyRow("Devuelto", JSON.stringify(b.refunded))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
          <strong>Retenido (held)</strong><strong style={{ color: T.warn }}>{moneyJson(b.held)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
          <span style={{ color: T.muted }}>Disponible (sin asignar)</span><span>{moneyJson(b.available)}</span>
        </div>
      </div>
    </>
  );
}

function companies(pc: PageContext): ReactNode {
  const list = pc.services.platform.businesses(pc.request);
  return (
    <>
      <h1 style={{ fontSize: 20 }}>Empresas</h1>
      <p style={{ color: T.muted }}>{list.length} empresa(s) en la plataforma.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ textAlign: "left", color: T.muted }}><th style={{ padding: "8px" }}>Empresa</th><th>Plan</th><th>Estado</th><th>Alta</th></tr></thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id} style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ padding: "8px" }}>{b.name}</td>
              <td>{b.planKey}</td>
              <td>{b.status}</td>
              <td style={{ color: T.muted }}>{new Date(b.createdAt).toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function alertsPage(pc: PageContext): ReactNode {
  const all = pc.services.platform.alerts(pc.request);
  return (
    <>
      <h1 style={{ fontSize: 20 }}>Alertas</h1>
      {all.length === 0 ? <p style={{ color: T.muted }}>Sin alertas.</p> : alertsPreview(pc)}
    </>
  );
}

function healthPage(pc: PageContext): ReactNode {
  const components: [string, string][] = [
    ["Host HTTP", "operativo"], ["Base de datos", pc.persistence?.mode === "local-file" ? "operativo (local)" : "en memoria"],
    ["Shopify OAuth", "preparado (fake local)"], ["Webhooks", "preparado"], ["Creator Marketplace", "operativo"],
    ["Motor financiero (simulado)", "operativo"], ["Vault", "operativo (simulado)"], ["IA", "mock determinista"],
    ["Almacenamiento", "no conectado"], ["Eventra", "no conectado"], ["Postgres alojado", "no conectado"],
  ];
  return (
    <>
      <h1 style={{ fontSize: 20 }}>Salud del sistema</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 10 }}>
        {components.map(([name, status]) => {
          const ok = status.startsWith("operativo");
          const off = status.includes("no conectado");
          return (
            <div key={name} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{name}</span>
              <span style={{ fontSize: 11, color: ok ? T.ok : off ? T.muted : T.warn }}>● {status}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function placeholder(sub: string): ReactNode {
  return (
    <>
      <h1 style={{ fontSize: 20 }}>{sub.replace(/-/g, " ") || "Sección"}</h1>
      <p style={{ color: T.muted }}>Módulo del Internal OS preparado; contenido detallado en una iteración siguiente (ver docs/internal-os/).</p>
    </>
  );
}
