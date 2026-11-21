import { beforeEach, describe, expect, it } from "vitest";
import {
  checkSignRateLimit,
  resetSignRateLimitForTests,
  signRateLimitSizeForTests,
} from "@/lib/esign/rate-limit";

const T0 = 1_800_000_000_000;
const WINDOW_MS = 60_000;

describe("署名の回数制限", () => {
  beforeEach(() => {
    resetSignRateLimitForTests();
  });

  it("1 分に 5 回まで通し、6 回目は止め、1 分たつと通す", () => {
    for (let i = 0; i < 5; i += 1) expect(checkSignRateLimit("192.0.2.1", T0 + i)).toBe(true);
    expect(checkSignRateLimit("192.0.2.1", T0 + 10)).toBe(false);
    expect(checkSignRateLimit("192.0.2.1", T0 + WINDOW_MS + 1)).toBe(true);
  });

  it("期限切れの行は、行が増えたときに消える", () => {
    for (let i = 0; i < 1_200; i += 1) checkSignRateLimit(`ip-${i}`, T0);
    expect(signRateLimitSizeForTests()).toBeGreaterThan(1_000);

    checkSignRateLimit("ip-new", T0 + WINDOW_MS + 1_000);

    expect(signRateLimitSizeForTests()).toBe(1);
  });

  it("制限中の行は、掃除で消えず、解放されない", () => {
    for (let i = 0; i < 1_100; i += 1) checkSignRateLimit(`ip-${i}`, T0);
    for (let i = 0; i < 5; i += 1) checkSignRateLimit("limited", T0 + 30_000 + i);

    // 古い行（T0 から 1 分以上）は期限切れ。limited は T0 + 30 秒に始まったのでまだ有効
    checkSignRateLimit("other", T0 + WINDOW_MS + 1_000);

    expect(signRateLimitSizeForTests()).toBe(2);
    expect(checkSignRateLimit("limited", T0 + WINDOW_MS + 2_000)).toBe(false);
  });

  it("期限切れの行がなくても、10,000 行を超えたら古い順に消して 10,000 行にする", () => {
    for (let i = 0; i < 10_500; i += 1) checkSignRateLimit(`ip-${i}`, T0 + i);

    expect(signRateLimitSizeForTests()).toBe(10_000);

    const now = T0 + 10_500;
    // いちばん古い行は消えていて、新しい行として 5 回まで通る
    for (let i = 0; i < 5; i += 1) expect(checkSignRateLimit("ip-0", now)).toBe(true);
    // いちばん新しい行は残っていて、1 回目の数えが引き継がれているので 4 回まで通り、5 回目で止まる
    for (let i = 0; i < 4; i += 1) expect(checkSignRateLimit("ip-10499", now)).toBe(true);
    expect(checkSignRateLimit("ip-10499", now)).toBe(false);
  });
});
