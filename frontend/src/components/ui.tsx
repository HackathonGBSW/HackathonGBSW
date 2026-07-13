import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import "./ui.css";

type Variant = "primary" | "secondary" | "dark" | "outline" | "text" | "danger";
type Size = "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}) {
  const inputId = id ?? props.name;
  return (
    <label className={`field ${className}`.trim()} htmlFor={inputId}>
      {label ? <span className="field__label">{label}</span> : null}
      <input
        id={inputId}
        className={`field__input ${error ? "is-err" : ""}`}
        {...props}
      />
      {error ? <span className="field__err">{error}</span> : null}
    </label>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function RankPill({ rank, score }: { rank: string; score?: number }) {
  return (
    <span className="rank-pill">
      <strong>{rank}</strong>
      {score !== undefined ? <span className="num muted">{score}</span> : null}
    </span>
  );
}
