import "server-only";

import type {
  PaymentMode,
} from "@/lib/payments/types";

export const PLACEMENT_SERVICE = {
  code:
    "application_distribution",

  name:
    "Application Distribution Service",

  amountKes:
    200,

  currency:
    "KES",
} as const;

function resolvePaymentMode():
  PaymentMode {
  const value =
    process.env
      .PAYMENTS_MODE
      ?.trim()
      .toLowerCase();

  switch (value) {
    case "mock":
      return "mock";

    case "sandbox":
      return "sandbox";

    case "live":
      return "live";

    default:
      return "disabled";
  }
}

export const paymentMode =
  resolvePaymentMode();

export const paymentsEnabled =
  paymentMode !==
  "disabled";

export const mockPaymentsEnabled =
  paymentMode ===
  "mock";

export const sandboxPaymentsEnabled =
  paymentMode ===
  "sandbox";

export const livePaymentsEnabled =
  paymentMode ===
  "live";

export const externalPaymentsEnabled =
  sandboxPaymentsEnabled ||
  livePaymentsEnabled;

/*
 * Never silently switch external
 * providers into production.
 *
 * Only PAYMENTS_MODE=live selects
 * production provider endpoints.
 */
export const paymentProviderEnvironment =
  livePaymentsEnabled
    ? "live"
    : "sandbox";

export function getAppBaseUrl() {
  const value =
    process.env
      .APP_BASE_URL
      ?.trim();

  if (!value) {
    throw new Error(
      "Missing APP_BASE_URL environment variable.",
    );
  }

  let url: URL;

  try {
    url =
      new URL(value);
  } catch {
    throw new Error(
      "APP_BASE_URL is invalid.",
    );
  }

  if (
    livePaymentsEnabled &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Live payments require an HTTPS APP_BASE_URL.",
    );
  }

  return url.origin;
}