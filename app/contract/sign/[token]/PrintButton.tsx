"use client";

export default function PrintButton() {
  return <button className="secondary no-print" type="button" onClick={() => window.print()}>控えを印刷・PDF保存</button>;
}
