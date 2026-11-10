/** Logo : pastille orange et son pictogramme (meme logo que sur l'Accueil). */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5.5" fill="#FF4D00"/><g transform="translate(4.56 4.56) scale(.62)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 11h17M12 11v9.5"/></g></svg>
  );
}
