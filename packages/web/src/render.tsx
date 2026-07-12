import { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Server-side rendering to a complete, self-contained HTML document. Pages are
 * plain React (reusing @partnera/ui) rendered to static markup — no bundler, no
 * client runtime, no hydration. This keeps the delivery layer dependency-light
 * and the apps progressively-enhanced (they work with JavaScript disabled, which
 * is also the accessible-by-default baseline). See docs/24-delivery-ux.md.
 */

/**
 * Global stylesheet: the design tokens (mirroring @partnera/ui/tokens.css) plus
 * app-shell layout, responsive breakpoints, and accessibility rules. Components
 * still reference the same `--pt-*` variables, so light/dark theming is uniform.
 */
const GLOBAL_CSS = `
:root{
  --pt-color-primary:#4f46e5;--pt-color-primary-text:#fff;--pt-color-surface:#fff;
  --pt-color-surface-muted:#f5f6f8;--pt-color-border:#e2e4e9;--pt-color-text:#1a1c21;
  --pt-color-text-muted:#6b7280;--pt-color-success:#15803d;--pt-color-warning:#b45309;
  --pt-color-danger:#b91c1c;--pt-color-info:#1d4ed8;
  --pt-font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --pt-font-mono:ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --pt-color-primary:#818cf8;--pt-color-primary-text:#0b0c0f;--pt-color-surface:#16181d;
  --pt-color-surface-muted:#1f222a;--pt-color-border:#2c303a;--pt-color-text:#e8eaed;
  --pt-color-text-muted:#9aa0ac;--pt-color-success:#4ade80;--pt-color-warning:#fbbf24;
  --pt-color-danger:#f87171;--pt-color-info:#60a5fa;
}}
:root[data-theme="light"]{
  --pt-color-primary:#4f46e5;--pt-color-primary-text:#fff;--pt-color-surface:#fff;
  --pt-color-surface-muted:#f5f6f8;--pt-color-border:#e2e4e9;--pt-color-text:#1a1c21;
  --pt-color-text-muted:#6b7280;--pt-color-success:#15803d;--pt-color-warning:#b45309;
  --pt-color-danger:#b91c1c;--pt-color-info:#1d4ed8;
}
:root[data-theme="dark"]{
  --pt-color-primary:#818cf8;--pt-color-primary-text:#0b0c0f;--pt-color-surface:#16181d;
  --pt-color-surface-muted:#1f222a;--pt-color-border:#2c303a;--pt-color-text:#e8eaed;
  --pt-color-text-muted:#9aa0ac;--pt-color-success:#4ade80;--pt-color-warning:#fbbf24;
  --pt-color-danger:#f87171;--pt-color-info:#60a5fa;
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:var(--pt-font-family);background:var(--pt-color-surface-muted);
  color:var(--pt-color-text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;
}
a{color:var(--pt-color-primary);text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--pt-color-primary);outline-offset:2px}
.pt-skip{position:absolute;left:-9999px;top:0;background:var(--pt-color-primary);
  color:var(--pt-color-primary-text);padding:8px 12px;border-radius:0 0 8px 0;z-index:2000}
.pt-skip:focus{left:0}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* App shell: sidebar + content, responsive. */
.pt-shell{display:grid;grid-template-columns:248px 1fr;min-height:100vh}
.pt-sidebar{background:var(--pt-color-surface);border-right:1px solid var(--pt-color-border);
  padding:16px;position:sticky;top:0;height:100vh;overflow-y:auto}
.pt-main{padding:24px;max-width:1200px;width:100%}
.pt-nav-group{margin:12px 0}
.pt-nav-group h4{margin:8px 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--pt-color-text-muted)}
.pt-nav a{display:block;padding:7px 10px;border-radius:8px;color:var(--pt-color-text);font-size:13px}
.pt-nav a:hover{background:var(--pt-color-surface-muted);text-decoration:none}
.pt-nav a[aria-current="page"]{background:var(--pt-color-primary);color:var(--pt-color-primary-text)}
.pt-navwrap>summary{display:none}
.pt-topbar{display:none;align-items:center;justify-content:space-between;
  padding:12px 16px;background:var(--pt-color-surface);border-bottom:1px solid var(--pt-color-border);
  position:sticky;top:0;z-index:200}
.pt-grid{display:grid;gap:16px}
.pt-grid.cols-2{grid-template-columns:repeat(2,1fr)}
.pt-grid.cols-3{grid-template-columns:repeat(3,1fr)}
.pt-grid.cols-4{grid-template-columns:repeat(4,1fr)}
.pt-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}

@media (max-width:1024px){
  .pt-shell{grid-template-columns:200px 1fr}
  .pt-grid.cols-4{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:768px){
  .pt-shell{grid-template-columns:1fr}
  .pt-topbar{display:flex}
  .pt-sidebar{position:static;height:auto;border-right:none;
    border-bottom:1px solid var(--pt-color-border)}
  .pt-navwrap>summary{display:block;list-style:none;cursor:pointer;padding:8px;font-weight:600;
    border:1px solid var(--pt-color-border);border-radius:8px}
  .pt-grid.cols-2,.pt-grid.cols-3,.pt-grid.cols-4{grid-template-columns:1fr}
  .pt-main{padding:16px}
}
@media print{.pt-sidebar,.pt-topbar{display:none}.pt-shell{grid-template-columns:1fr}}
`;

export interface DocumentOptions {
  readonly title: string;
  /** "auto" (default) follows the OS; "light"/"dark" force a theme. */
  readonly theme?: "auto" | "light" | "dark";
}

/** Render a page element into a full, standalone HTML document string. */
export function renderDocument(element: ReactElement, opts: DocumentOptions): string {
  const body = renderToStaticMarkup(element);
  const themeAttr = opts.theme && opts.theme !== "auto" ? ` data-theme="${opts.theme}"` : "";
  return (
    `<!doctype html><html lang="en"${themeAttr}>` +
    `<head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>${escapeHtml(opts.title)} - Partnera</title>` +
    `<link rel="manifest" href="/manifest.webmanifest"/>` +
    `<link rel="icon" href="/favicon.ico"/>` +
    `<link rel="apple-touch-icon" href="/icon-512.png"/>` +
    `<meta name="theme-color" content="#4f46e5"/>` +
    `<meta name="application-name" content="Partnera"/>` +
    `<meta name="apple-mobile-web-app-title" content="Partnera"/>` +
    `<meta name="apple-mobile-web-app-capable" content="yes"/>` +
    `<meta name="mobile-web-app-capable" content="yes"/>` +
    `<style>${GLOBAL_CSS}</style></head>` +
    `<body>${body}</body></html>`
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
