import { type ReactNode } from "react";
import { tokens } from "./tokens";

interface OverlayShellProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "center" → Dialog, "right"/"left" → Drawer. */
  placement: "center" | "right" | "left";
}

function OverlayShell({ open, onClose, title, children, footer, placement }: OverlayShellProps): JSX.Element | null {
  if (!open) return null;

  const panelStyle =
    placement === "center"
      ? { width: "min(560px, 92vw)", maxHeight: "85vh", borderRadius: tokens.radius.lg }
      : {
          width: "min(440px, 92vw)",
          height: "100vh",
          borderRadius: 0,
          [placement === "right" ? "marginLeft" : "marginRight"]: "auto",
        };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: placement === "center" ? "center" : "stretch",
        justifyContent: placement === "left" ? "flex-start" : placement === "right" ? "flex-end" : "center",
        zIndex: tokens.zIndex.modal,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          boxShadow: tokens.shadow.lg,
          overflow: "hidden",
          ...panelStyle,
        }}
      >
        {title ? (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${tokens.space.md} ${tokens.space.lg}`,
              borderBottom: `1px solid ${tokens.color.border}`,
            }}
          >
            <h3 style={{ margin: 0, fontSize: tokens.font.size.lg, color: tokens.color.text }}>{title}</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: tokens.color.textMuted }}
            >
              ×
            </button>
          </header>
        ) : null}
        <div style={{ padding: tokens.space.lg, overflowY: "auto", flex: 1, color: tokens.color.text }}>
          {children}
        </div>
        {footer ? (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: tokens.space.sm,
              padding: `${tokens.space.md} ${tokens.space.lg}`,
              borderTop: `1px solid ${tokens.color.border}`,
            }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog(props: DialogProps): JSX.Element | null {
  return <OverlayShell {...props} placement="center" />;
}

export interface DrawerProps extends DialogProps {
  side?: "left" | "right";
}

export function Drawer({ side = "right", ...props }: DrawerProps): JSX.Element | null {
  return <OverlayShell {...props} placement={side} />;
}
