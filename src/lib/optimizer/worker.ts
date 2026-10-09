/// <reference lib="webworker" />
import { optimize } from "./engine";
import type { OptimizeRequest } from "./types";

self.onmessage = (e: MessageEvent<OptimizeRequest>) => {
  try {
    self.postMessage({ ok: true, result: optimize(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
