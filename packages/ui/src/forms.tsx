import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { tokens } from "./tokens";

const controlBase = {
  width: "100%",
  fontFamily: tokens.font.family,
  fontSize: tokens.font.size.md,
  color: tokens.color.text,
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  padding: `${tokens.space.sm} ${tokens.space.md}`,
  boxSizing: "border-box" as const,
};

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/** Consistent label + hint + error wrapper for any control. */
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.xs }}>
      <label htmlFor={htmlFor} style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.medium, color: tokens.color.text }}>
        {label}
        {required ? <span style={{ color: tokens.color.danger }}> *</span> : null}
      </label>
      {children}
      {error ? (
        <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.danger }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textMuted }}>{hint}</span>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, style, ...rest }: InputProps): JSX.Element {
  return (
    <input
      aria-invalid={invalid}
      style={{ ...controlBase, borderColor: invalid ? tokens.color.danger : tokens.color.border, ...style }}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, style, ...rest }: TextareaProps): JSX.Element {
  return (
    <textarea
      aria-invalid={invalid}
      style={{ ...controlBase, minHeight: 96, resize: "vertical", borderColor: invalid ? tokens.color.danger : tokens.color.border, ...style }}
      {...rest}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
}

export function Select({ options, style, ...rest }: SelectProps): JSX.Element {
  return (
    <select style={{ ...controlBase, ...style }} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
