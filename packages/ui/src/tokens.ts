/**
 * Design tokens — the single source of truth for the visual system. Components
 * reference the CSS-variable names (see tokens.css) so light/dark theming works
 * without per-component logic; this object exposes the same scale to consumers
 * that need raw values (charts, canvases). Desktop-first, responsive-ready.
 */
export const tokens = {
  color: {
    // Semantic CSS variables resolved in tokens.css for light/dark.
    primary: "var(--pt-color-primary)",
    primaryText: "var(--pt-color-primary-text)",
    surface: "var(--pt-color-surface)",
    surfaceMuted: "var(--pt-color-surface-muted)",
    border: "var(--pt-color-border)",
    text: "var(--pt-color-text)",
    textMuted: "var(--pt-color-text-muted)",
    success: "var(--pt-color-success)",
    warning: "var(--pt-color-warning)",
    danger: "var(--pt-color-danger)",
    info: "var(--pt-color-info)",
  },
  space: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
  },
  radius: { sm: "4px", md: "8px", lg: "12px", pill: "999px" },
  font: {
    family: "var(--pt-font-family)",
    mono: "var(--pt-font-mono)",
    size: { xs: "12px", sm: "13px", md: "14px", lg: "16px", xl: "20px", "2xl": "28px" },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.2, normal: 1.5 },
  },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.06)",
    md: "0 4px 12px rgba(0,0,0,0.10)",
    lg: "0 12px 32px rgba(0,0,0,0.16)",
  },
  zIndex: { base: 0, dropdown: 100, sticky: 200, overlay: 900, modal: 1000, toast: 1100 },
  breakpoint: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
} as const;

export type Tokens = typeof tokens;

/** Semantic intents shared across Button, Badge, Alert, Tag, etc. */
export type Intent = "primary" | "neutral" | "success" | "warning" | "danger" | "info";

export type Size = "sm" | "md" | "lg";
