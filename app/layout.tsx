import type { Metadata } from "next";
import { getKitConfigState } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "顧客台帳と電子契約キット",
  description: "顧客情報と電子契約の管理",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { isConfigured } = getKitConfigState();
  return (
    <html lang="ja">
      <body>
        {!isConfigured ? (
          <div className="config-notice" role="status">
            設定がまだです。kit.config.example.ts をもとに kit.config.ts をご用意ください。
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
