import { Logo } from "./Logo";

export function Brand() {
  return <div className="flex items-center gap-3">
    <Logo />
    <div>
      <h1 className="text-lg font-bold leading-none">F O R M A T</h1>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">OPTIMISATION DE DÉCOUPE 2D</p>
    </div>
  </div>;
}