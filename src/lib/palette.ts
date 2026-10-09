// Couleurs des plans de decoupe — valeurs definies dans src/styles.css.
export const PLAN_COLORS = Array.from({ length: 10 }, (_, i) => `var(--plan-${i + 1})`);
export const planColor = (index: number) => PLAN_COLORS[index % PLAN_COLORS.length];
export const OFFCUT = { waste: "var(--offcut-waste)", reuse: "var(--offcut-reuse)" };
