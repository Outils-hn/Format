import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_INFO } from "@/lib/appInfo";
import { Logo } from "./Logo";
import { BackupLink, BackupReminder } from "@/components/BackupControls";
import { BACKUP_CONFIG } from "@/lib/backup-config";

export function AppFooter({ aboveLaunchBar = false }: { aboveLaunchBar?: boolean }) {
  const updated = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${APP_INFO.updatedAt}T00:00:00Z`));

  return <footer className={`shrink-0 px-4 pt-6 text-center text-xs text-muted-foreground print:hidden ${aboveLaunchBar ? "pb-40" : "pb-6"}`}>
    <Dialog.Root>
      <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <span>{APP_INFO.name} v{APP_INFO.version} ·</span>
        <Dialog.Trigger asChild>
          <Button variant="ghost" className="h-auto rounded-sm px-0.5 py-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground">
            Conçu par {APP_INFO.author}
          </Button>
        </Dialog.Trigger>
        <span>· {APP_INFO.year} ·</span>
        <BackupLink cfg={BACKUP_CONFIG} appName={APP_INFO.name} />
      </p>
      {/* En bas a gauche, a cote de la pastille de calcul (centree) */}
      <BackupReminder cfg={BACKUP_CONFIG} className="bottom-5" />
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 print:hidden" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-left shadow-lg print:hidden">
          <Dialog.Title className="mb-5 text-sm font-semibold text-foreground">À propos</Dialog.Title>
          <div className="mb-4 flex items-center gap-3">
            <Logo className="h-10 w-10 shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{APP_INFO.name}</p>
              <p className="text-xs text-muted-foreground">Version {APP_INFO.version}</p>
            </div>
          </div>
          <p className="mb-3 text-sm text-foreground">Conçu et développé par {APP_INFO.author}</p>
          <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">{APP_INFO.description}</Dialog.Description>
          <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">Dernière mise à jour : <time dateTime={APP_INFO.updatedAt}>{updated}</time></p>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 text-muted-foreground" aria-label="Fermer"><X size={16} /></Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </footer>;
}