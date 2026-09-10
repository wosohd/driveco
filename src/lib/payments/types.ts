export const PAYMENT_PROVIDERS = [
  "mpesa",
  "stripe",
] as const;

export type PaymentProvider =
  (typeof PAYMENT_PROVIDERS)[number];

export type PaymentStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded";

export type PlacementStatus =
  | "offered"
  | "payment_pending"
  | "paid"
  | "distribution_pending"
  | "distributed"
  | "cancelled";