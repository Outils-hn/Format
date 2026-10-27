import { num, panelGroup } from "@/lib/format";

/** Shared screen label: traceable panel range and separate quantity badge. */
export function PanelGroupLabel({ indexes }: { indexes: number[] }) {
  const count = new Set(indexes).size;
  return <span className="inline-flex flex-wrap items-center gap-2">
    <span>{panelGroup(indexes, false)}</span>
    {count > 1 && <span className="inline-flex shrink-0 items-center rounded bg-foreground px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-background">×{num(count)}</span>}
  </span>;
}
