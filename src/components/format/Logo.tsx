/** Logo : un panneau decoupe, la chute reutilisable en orange (seule couleur de l'appli). */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" className={className} aria-hidden>
      <rect x="1" y="1" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
      <path d="M12 1v20M1 12h11" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
      <rect x="12.75" y="12.75" width="7.5" height="7.5" fill="var(--signal)" />
    </svg>
  );
}
