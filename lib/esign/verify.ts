import { sha256Hex } from "@/lib/esign/core";

export function verifyContractContent(contractHtml: string, expectedHash: string): boolean {
  return /^[a-f0-9]{64}$/.test(expectedHash) && sha256Hex(contractHtml) === expectedHash;
}
