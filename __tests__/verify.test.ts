import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/esign/core";
import { verifyContractContent } from "@/lib/esign/verify";

describe("本文ハッシュ照合", () => {
  it("一致する本文を確認する", () => expect(verifyContractContent("<p>見本</p>", sha256Hex("<p>見本</p>"))).toBe(true));
  it("改ざんされた本文を不一致にする", () => expect(verifyContractContent("<p>変更</p>", sha256Hex("<p>見本</p>"))).toBe(false));
});
