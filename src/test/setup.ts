import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
  callback(performance.now());
  return 0;
};
