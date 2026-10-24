import type { KitConfig } from "./lib/config-types";

const config = {
  issuer: {
    companyName: "株式会社サンプル商事",
    representativeTitle: "代表取締役",
    representativeName: "山田 花子",
    addressLines: ["郵便番号を入力", "住所を入力"],
    contactEmail: "contact@example.com",
    phone: "",
    sealText: "見本",
    sealColor: "#b8322a",
  },
  siteUrl: "http://localhost:3000",
  mail: {
    transport: "none",
    fromName: "契約窓口",
  },
  signingTokenDays: 14,
  signedDocumentViewDays: null,
  stageTags: ["見込み", "提案中", "契約", "取引中", "休眠"],
  autoAdvanceStageOnSign: true,
} satisfies KitConfig;

export default config;
