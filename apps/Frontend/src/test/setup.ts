import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

if (typeof window !== "undefined" && !window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return window.setTimeout(() => callback(performance.now()), 0);
  };
}

if (typeof window !== "undefined" && !window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (handle: number) => {
    window.clearTimeout(handle);
  };
}
