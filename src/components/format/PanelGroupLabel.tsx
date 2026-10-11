import { num, panelGroup } from "@/lib/format";

/** Shared screen label: traceable panel range and separate quantity badge. */
export function PanelGroupLabel({ indexes }: { indexes: number[] }) {
  const count = new Set(indexes).size;
  return <span className="inline-flex flex-wrap items-center gap-2">
    <span>{panelGroup(indexes, false)}</span>
    {count > 1 && <span className="inline-flex shrink-0 items-center rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">x {num(count)}</span>}
  </span>;
}