import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { type Intent, type Size, tokens } from "./tokens";
import { intentColor, sizeStyles } from "./style-utils";

export type ButtonVariant = "solid" | "outline" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent;
  variant?: ButtonVariant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  intent = "primary",
  variant = "solid",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps): JSX.Element {
  const base = intentColor(intent);
  const variantStyle: CSSProperties =
    variant === "solid"
      ? { background: base, color: tokens.color.primaryText, border: `1px solid ${base}` }
      : variant === "outline"
        ? { background: "transparent", color: base, border: `1px solid ${tokens.color.border}` }
        : { background: "transparent", color: base, border: "1px solid transparent" };

  return (
    <button
      disabled={disabled ?? loading}
      aria-busy={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.space.sm,
        width: fullWidth ? "100%" : undefined,
        borderRadius: tokens.radius.md,
        fontFamily: tokens.font.family,
        fontWeight: tokens.font.weight.medium,
        cursor: disabled ?? loading ? "not-allowed" : "pointer",
        opacity: disabled ?? loading ? 0.6 : 1,
        ...sizeStyles(size),
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner size={size} /> : null}
      {children}
    </button>
  );
}

export interface SpinnerProps {
  size?: Size;
  label?: string;
}

export function Spinner({ size = "md", label = "Loading" }: SpinnerProps): JSX.Element {
  const px = size === "sm" ? 12 : size === "lg" ? 20 : 16;
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        width: px,
        height: px,
        display: "inline-block",
        border: "2px solid currentColor",
        borderRightColor: "transparent",
        borderRadius: "50%",
        animation: "pt-spin 0.6s linear infinite",
      }}
    />
  );
}

export interface BadgeProps {
  intent?: Intent;
  children: ReactNode;
}

export function Badge({ intent = "neutral", children }: BadgeProps): JSX.Element {
  const base = intentColor(intent);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `2px ${tokens.space.sm}`,
        borderRadius: tokens.radius.pill,
        fontSize: tokens.font.size.xs,
        fontWeight: tokens.font.weight.semibold,
        color: base,
        border: `1px solid ${base}`,
        background: "transparent",
      }}
    >
      {children}
    </span>
  );
}

export interface TagProps {
  children: ReactNode;
  onRemove?: () => void;
}

export function Tag({ children, onRemove }: TagProps): JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.space.xs,
        padding: `2px ${tokens.space.sm}`,
        borderRadius: tokens.radius.sm,
        fontSize: tokens.font.size.xs,
        background: tokens.color.surfaceMuted,
        color: tokens.color.text,
        border: `1px solid ${tokens.color.border}`,
      }}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          style={{ border: "none", background: "none", cursor: "pointer", color: tokens.color.textMuted }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export interface ProgressProps {
  /** 0..1 */
  value: number;
  intent?: Intent;
  label?: string;
}

export function Progress({ value, intent = "primary", label }: ProgressProps): JSX.Element {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{
        height: 8,
        width: "100%",
        background: tokens.color.surfaceMuted,
        borderRadius: tokens.radius.pill,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: intentColor(intent) }} />
    </div>
  );
}
