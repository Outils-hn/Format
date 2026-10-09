import type { OptimizeRequest, OptimizeResult } from "./types";

export * from "./types";

/** Lance l'optimisation dans un Web Worker (l'interface reste fluide). */
export function runOptimization(req: OptimizeRequest): Promise<OptimizeResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      w.terminate();
      if (e.data.ok) resolve(e.data.result); else reject(new Error(e.data.error));
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message)); };
    w.postMessage(req);
  });
}
