import "server-only";

import Stripe from "stripe";

import {
  getAppBaseUrl,
  PLACEMENT_SERVICE,
} from "@/lib/payments/config";

let stripeClient:
  Stripe | null =
    null;

function getStripeSecretKey() {
  const key =
    process.env
      .STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Stripe is not configured.",
    );
  }

  return key;
}

export function getStripeClient() {
  if (!stripeClient) {
    stripeClient =
      new Stripe(
        getStripeSecretKey(),
        {
          maxNetworkRetries:
            2,
        },
      );
  }

  return stripeClient;
}

export async function createStripeCheckout(
  options: {
    paymentId:
      string;

    placementRequestId:
      string;

    submissionId:
      string;

    applicationReference:
      string;

    customerEmail?:
      string | null;
  },
) {
  const stripe =
    getStripeClient();

  const baseUrl =
    getAppBaseUrl();

  /*
   * KES is represented by Stripe in
   * minor units for this integration:
   *
   * KSh 200.00 → 20000
   */
  const amountMinor =
    PLACEMENT_SERVICE.amountKes *
    100;

  const session =
    await stripe.checkout.sessions.create(
      {
        mode:
          "payment",

        client_reference_id:
          options.paymentId,

        customer_email:
          options.customerEmail ??
          undefined,

        payment_method_types: [
          "card",
        ],

        line_items: [
          {
            quantity:
              1,

            price_data: {
              currency:
                "kes",

              unit_amount:
                amountMinor,

              product_data: {
                name:
                  PLACEMENT_SERVICE.name,

                description:
                  "DriveCo application distribution service. Payment does not guarantee an interview or employment.",
              },
            },
          },
        ],

        metadata: {
          paymentId:
            options.paymentId,

          placementRequestId:
            options.placementRequestId,

          submissionId:
            options.submissionId,

          applicationReference:
            options.applicationReference,

          serviceCode:
            PLACEMENT_SERVICE.code,
        },

        payment_intent_data: {
          metadata: {
            paymentId:
              options.paymentId,

            placementRequestId:
              options.placementRequestId,

            submissionId:
              options.submissionId,

            serviceCode:
              PLACEMENT_SERVICE.code,
          },
        },

        success_url:
          `${baseUrl}/placement/${encodeURIComponent(
            options.submissionId,
          )}?payment=stripe-return`,

        cancel_url:
          `${baseUrl}/placement/${encodeURIComponent(
            options.submissionId,
          )}?payment=stripe-cancelled`,
      },
    );

  if (
    !session.url
  ) {
    throw new Error(
      "Stripe did not return a checkout URL.",
    );
  }

  return {
    sessionId:
      session.id,

    checkoutUrl:
      session.url,
  };
}

/* ---------------------------------------
   Stripe Webhook Verification
--------------------------------------- */

export function verifyStripeWebhook(
  rawBody:
    string,

  signature:
    string,
) {
  const webhookSecret =
    process.env
      .STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "Stripe webhook verification is not configured.",
    );
  }

  return getStripeClient()
    .webhooks
    .constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
}