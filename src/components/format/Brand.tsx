import { Logo } from "./Logo";

export function Brand() {
  return <div className="flex items-center gap-2.5">
    <Logo />
    <h1 className="text-[17px] font-semibold leading-none tracking-tight">Format</h1>
    <span className="sr-only">Optimisation de découpe 2D</span>
  </div>;
}
