import {
  z,
} from "zod";

export const paymentProviderSchema =
  z.enum([
    "mpesa",
    "stripe",
  ]);

export const initiatePaymentSchema =
  z.object({
    submissionId:
      z
        .string()
        .uuid(
          "Submission ID is invalid.",
        ),

    provider:
      paymentProviderSchema,

    serviceConsent:
      z
        .boolean()
        .refine(
          (value) =>
            value,
          {
            message:
              "You must accept the placement service terms before continuing.",
          },
        ),

    /*
     * Required later by the server
     * only when a real/sandbox
     * M-Pesa STK Push is requested.
     *
     * Mock mode does not require it.
     */
    phoneNumber:
      z
        .string()
        .trim()
        .min(9)
        .max(20)
        .optional(),
  });

export const paymentStatusSchema =
  z.object({
    submissionId:
      z
        .string()
        .uuid(
          "Submission ID is invalid.",
        ),
  });

export const mockPaymentOutcomeSchema =
  z.enum([
    "succeeded",
    "failed",
    "cancelled",
  ]);

export const mockCompletePaymentSchema =
  z.object({
    paymentId:
      z
        .string()
        .uuid(
          "Payment ID is invalid.",
        ),

    outcome:
      mockPaymentOutcomeSchema,
  });

export type PaymentProvider =
  z.infer<
    typeof paymentProviderSchema
  >;

export type MockPaymentOutcome =
  z.infer<
    typeof mockPaymentOutcomeSchema
  >;