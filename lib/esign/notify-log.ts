// 署名後の通知・メールが失敗したときの記録。
// 出すのは、コードで決めた理由の分類だけです。宛先・件名・本文・トークン・API の応答・秘密は出しません。
export type NotifyFailureReason = "config" | "network" | "rejected" | "hook" | "mail";

export function logNotifyFailure(reason: NotifyFailureReason): void {
  console.error(`[esign] notify failed: ${reason}`);
}
