import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  /** 0 s'affiche comme un champ vide (quantités). */
  zeroIsEmpty?: boolean;
  invalid?: boolean;
};

const parse = (s: string) => {
  if (s.trim() === "") return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Champ numérique : reste vide pendant la saisie, sélectionne tout au clic. */
export function NumInput({ value, onChange, zeroIsEmpty, invalid, className = "", onFocus, onMouseUp, ...rest }: Props) {
  const empty = (v: number | null | undefined) => v == null || !Number.isFinite(v) || (zeroIsEmpty && v === 0);
  const show = (v: number | null | undefined) => (empty(v) ? "" : String(v).replace(".", ","));
  const [draft, setDraft] = useState(() => show(value));
  const justFocused = useRef(false);
  useEffect(() => {
    const p = parse(draft);
    const same = p === value || (p == null && empty(value));
    if (!same) setDraft(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      inputMode="decimal"
      aria-invalid={invalid || undefined}
      className={`${className} ${invalid ? "border-destructive ring-2 ring-destructive/30" : ""}`}
      value={draft}
      onFocus={(e) => { e.currentTarget.select(); justFocused.current = true; onFocus?.(e); }}
      onMouseUp={(e) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } onMouseUp?.(e); }}
      onChange={(e) => { setDraft(e.target.value); onChange(parse(e.target.value)); }}
    />
  );
}
