import "server-only";

export type PaymentMode =
  | "disabled"
  | "mock"
  | "live";

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

  if (
    value === "mock" ||
    value === "live"
  ) {
    return value;
  }

  /*
   * Fail safely.
   *
   * Missing, malformed or unknown
   * configuration means payments
   * remain disabled.
   */

  return "disabled";
}

export const paymentMode =
  resolvePaymentMode();

export const paymentsEnabled =
  paymentMode !==
  "disabled";

export const livePaymentsEnabled =
  paymentMode ===
  "live";