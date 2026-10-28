import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { num } from "@/lib/format";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  /** 0 s'affiche comme un champ vide (quantités). */
  zeroIsEmpty?: boolean;
  invalid?: boolean;
};

// Separateurs de milliers acceptes a la saisie : espaces (dont insecables) et apostrophes suisses
const parse = (s: string) => {
  const c = s.replace(/[\s\u00a0\u202f'\u2019\u2018]/g, "").replace(",", ".");
  if (c === "") return null;
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : null;
};

/** Champ numérique : reste vide pendant la saisie, sélectionne tout au clic, remis en forme à la sortie. */
export function NumInput({ value, onChange, zeroIsEmpty, invalid, className = "", onFocus, onMouseUp, onBlur, ...rest }: Props) {
  const empty = (v: number | null | undefined) => v == null || !Number.isFinite(v) || (zeroIsEmpty && v === 0);
  // Meme format que le reste de l'appli : « 2 010 », « 1 652,5 »
  const show = (v: number | null | undefined) => (empty(v) ? "" : num(v, 3));
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
      onBlur={(e) => { const p = parse(draft); if (p != null) setDraft(show(p)); onBlur?.(e); }}
      onChange={(e) => { setDraft(e.target.value); onChange(parse(e.target.value)); }}
    />
  );
}
