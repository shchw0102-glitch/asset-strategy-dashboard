import { afterEach, expect, it, vi } from "vitest";
import { newId } from "./id";
afterEach(() => vi.unstubAllGlobals());
it("LAN HTTP처럼 randomUUID가 없어도 고유한 레코드 ID를 만든다", () => {
  const original = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: original.getRandomValues.bind(original),
  });
  const a = newId(),
    b = newId();
  expect(a).toMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  expect(a).not.toBe(b);
});
