import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 pt-16" onMouseDown={onClose}>
      <div className={`card-tech w-full ${wide ? "max-w-4xl" : "max-w-xl"}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="card-tech-head">
          <h2 className="card-title">{title}</h2>
          <button className="btn-ghost h-7 px-1.5" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
