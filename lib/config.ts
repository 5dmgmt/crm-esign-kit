import "server-only";

import configuredValue from "kit-config";
import type { KitConfig, MailTransport } from "@/lib/config-types";

export type ResolvedKitConfig = KitConfig & {
  signingTokenDays: number;
  signedDocumentViewDays: number | null;
  stageTags: string[];
};

type ConfigState = {
  config: ResolvedKitConfig;
  isConfigured: boolean;
};

let cachedState: ConfigState | null = null;

function isMailTransport(value: string | undefined): value is MailTransport {
  return value === "smtp" || value === "resend" || value === "none";
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function optionalPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function sealColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#b8322a";
}

function normalizeConfig(value: KitConfig): ResolvedKitConfig {
  const transportOverride = process.env.MAIL_TRANSPORT;
  return {
    ...value,
    issuer: { ...value.issuer, sealColor: sealColor(value.issuer.sealColor) },
    siteUrl: (process.env.SITE_URL || value.siteUrl).replace(/\/$/, ""),
    mail: {
      ...value.mail,
      transport: isMailTransport(transportOverride) ? transportOverride : value.mail.transport,
    },
    signingTokenDays: positiveInteger(value.signingTokenDays, 14),
    signedDocumentViewDays: optionalPositiveInteger(value.signedDocumentViewDays),
    stageTags:
      value.stageTags?.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim()) ??
      ["見込み", "提案中", "契約", "取引中", "休眠"],
  };
}

export function getKitConfigState(): ConfigState {
  if (cachedState) return cachedState;
  cachedState = {
    config: normalizeConfig(configuredValue),
    isConfigured: process.env.KIT_CONFIG_PRESENT === "true",
  };
  return cachedState;
}

export function getKitConfig(): ResolvedKitConfig {
  return getKitConfigState().config;
}

export function resetKitConfigForTests(): void {
  cachedState = null;
}
