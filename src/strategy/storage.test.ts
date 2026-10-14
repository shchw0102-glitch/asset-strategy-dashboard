import { describe, expect, it } from "vitest";
import { newDefaultState } from "./defaults";
import { parseState } from "./storage";
describe("백업 검증", () => {
  it("모든 입력값을 JSON 왕복 저장한다", () => {
    const s = newDefaultState();
    expect(parseState(JSON.stringify(s))).toEqual(s);
  });
  it("기본값 복사본이 원본을 바꾸지 않는다", () => {
    const s = newDefaultState();
    s.loans[0].principal = 0;
    expect(newDefaultState().loans[0].principal).toBe(40_000_000);
  });
  it("손상된 JSON, 다른 버전, 누락된 필드를 거부한다", () => {
    for (const raw of ["broken", "{}", '{"version":2}', "null"])
      expect(() => parseState(raw)).toThrow();
  });
  it("비정상 가격·대출·기간·수량을 거부한다", () => {
    for (const mutate of [
      (s: ReturnType<typeof newDefaultState>) => {
        s.holdings.exchangeRate = 0;
      },
      (s: ReturnType<typeof newDefaultState>) => {
        s.holdings.cntnQuantity = 1.5;
      },
      (s: ReturnType<typeof newDefaultState>) => {
        s.loans[0].months = 0;
      },
      (s: ReturnType<typeof newDefaultState>) => {
        s.housing.years = 100;
      },
      (s: ReturnType<typeof newDefaultState>) => {
        s.loans.push(s.loans[0]);
      },
      (s: ReturnType<typeof newDefaultState>) => {
        s.holdings.ccPrice = -1;
      },
    ]) {
      const s = newDefaultState();
      mutate(s);
      expect(() => parseState(JSON.stringify(s))).toThrow();
    }
  });
});
