import { type CSSProperties } from "react";
import { type Intent, type Size, tokens } from "./tokens";

/** The base color variable for a semantic intent. */
export function intentColor(intent: Intent): string {
  switch (intent) {
    case "primary":
      return tokens.color.primary;
    case "success":
      return tokens.color.success;
    case "warning":
      return tokens.color.warning;
    case "danger":
      return tokens.color.danger;
    case "info":
      return tokens.color.info;
    case "neutral":
      return tokens.color.textMuted;
  }
}

/** Vertical/horizontal padding + font size per control size. */
export function sizeStyles(size: Size): CSSProperties {
  switch (size) {
    case "sm":
      return { padding: `${tokens.space.xs} ${tokens.space.sm}`, fontSize: tokens.font.size.sm };
    case "md":
      return { padding: `${tokens.space.sm} ${tokens.space.md}`, fontSize: tokens.font.size.md };
    case "lg":
      return { padding: `${tokens.space.md} ${tokens.space.lg}`, fontSize: tokens.font.size.lg };
  }
}

export const focusRing: CSSProperties = {
  outline: `2px solid ${tokens.color.primary}`,
  outlineOffset: "1px",
};
