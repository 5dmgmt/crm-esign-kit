export type MailTransport = "smtp" | "resend" | "none";

export type KitConfig = {
  issuer: {
    companyName: string;
    representativeTitle: string;
    representativeName: string;
    addressLines: [string, string];
    contactEmail: string;
    phone?: string;
    sealText: string;
    sealColor: string;
  };
  siteUrl: string;
  mail: {
    transport: MailTransport;
    fromName: string;
  };
  signingTokenDays?: number;
  signedDocumentViewDays?: number | null;
  stageTags?: string[];
};
