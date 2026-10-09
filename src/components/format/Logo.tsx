export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="2" y="6" width="36" height="28" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <path d="M20 6v28M2 20h18M20 15h18M29 15v19" stroke="currentColor" strokeWidth="1.5" className="text-primary" fill="none" />
      <rect x="29.75" y="15.75" width="7.5" height="17.5" className="hatch-reuse" fill="var(--offcut-reuse)" opacity="0.35" />
    </svg>
  );
}
