import {
  NextResponse,
} from "next/server";

import Stripe from "stripe";

import {
  paymentProviderEnvironment,
} from "@/lib/payments/config";

import {
  verifyStripeWebhook,
} from "@/lib/payments/providers/stripe";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

function getPaymentIntentId(
  session:
    Stripe.Checkout.Session,
) {
  if (
    typeof session
      .payment_intent ===
      "string"
  ) {
    return session
      .payment_intent;
  }

  return session
    .payment_intent
    ?.id ??
    null;
}

export async function POST(
  request: Request,
) {
  /*
   * IMPORTANT:
   *
   * Stripe signature verification
   * requires the untouched raw body.
   * Do not call request.json() here.
   */

  const signature =
    request.headers.get(
      "stripe-signature",
    );

  if (!signature) {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const rawBody =
    await request.text();

  let event:
    Stripe.Event;

  try {
    event =
      verifyStripeWebhook(
        rawBody,
        signature,
      );
  } catch {
    console.error(
      "Stripe webhook signature verification failed.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const expectedLiveMode =
    paymentProviderEnvironment ===
    "live";

  /*
   * Never accept a test event against
   * live configuration or vice versa.
   */
  if (
    event.livemode !==
    expectedLiveMode
  ) {
    console.error(
      "Stripe webhook environment mismatch.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const supportedEvents = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ];

  if (
    !supportedEvents.includes(
      event.type,
    )
  ) {
    return NextResponse.json({
      ok: true,
    });
  }

  const session =
    event.data
      .object as
      Stripe.Checkout.Session;

  const paymentId =
    session.metadata
      ?.paymentId ??
    session.client_reference_id;

  if (!paymentId) {
    console.error(
      "Stripe webhook is missing DriveCo payment reference.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  /* ---------------------------------------
     Find DriveCo Payment
  --------------------------------------- */

  const {
    data:
      payment,

    error:
      paymentLookupError,
  } =
    await supabaseAdmin
      .from(
        "payments",
      )
      .select(
        `
          id,
          placement_request_id,
          provider,
          amount_kes,
          currency,
          status,
          provider_checkout_id,
          provider_event_id
        `,
      )
      .eq(
        "id",
        paymentId,
      )
      .eq(
        "provider",
        "stripe",
      )
      .maybeSingle();

  if (
    paymentLookupError ||
    !payment
  ) {
    console.error(
      "Stripe webhook payment lookup failed.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  /* ---------------------------------------
     Duplicate Delivery
  --------------------------------------- */

  if (
    payment
      .provider_event_id ===
    event.id
  ) {
    return NextResponse.json({
      ok: true,
    });
  }

  /* ---------------------------------------
     Validate Session Identity
  --------------------------------------- */

  if (
    payment
      .provider_checkout_id !==
    session.id
  ) {
    console.error(
      "Stripe Checkout session mismatch.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const expectedAmount =
    Number(
      payment.amount_kes,
    ) * 100;

  /*
   * Stripe expects amounts in the
   * currency's minor unit. KES is a
   * normal two-decimal currency.
   */
  if (
    session.amount_total !==
      expectedAmount ||
    session.currency
      ?.toLowerCase() !==
      "kes"
  ) {
    console.error(
      "Stripe webhook amount validation failed.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const now =
    new Date()
      .toISOString();

  /* ---------------------------------------
     SUCCESS
  --------------------------------------- */

  const successfulEvent =
    event.type ===
      "checkout.session.async_payment_succeeded" ||
    (
      event.type ===
        "checkout.session.completed" &&
      session.payment_status ===
        "paid"
    );

  if (
    successfulEvent
  ) {
    /*
     * Do not allow a later duplicate
     * event to downgrade/duplicate the
     * successful payment.
     */
    if (
      payment.status !==
      "succeeded"
    ) {
      const {
        error:
          updateError,
      } =
        await supabaseAdmin
          .from(
            "payments",
          )
          .update({
            status:
              "succeeded",

            provider_reference:
              getPaymentIntentId(
                session,
              ),

            provider_event_id:
              event.id,

            confirmed_at:
              now,

            failed_at:
              null,

            failure_code:
              null,

            failure_message:
              null,
          })
          .eq(
            "id",
            payment.id,
          );

      if (
        updateError
      ) {
        console.error(
          "Stripe success reconciliation failed.",
        );

        return NextResponse.json(
          {
            ok: false,
          },
          {
            status: 500,
          },
        );
      }
    }

    const {
      error:
        placementError,
    } =
      await supabaseAdmin
        .from(
          "placement_requests",
        )
        .update({
          status:
            "distribution_pending",
        })
        .eq(
          "id",
          payment
            .placement_request_id,
        );

    if (
      placementError
    ) {
      console.error(
        "Stripe placement reconciliation failed.",
      );

      return NextResponse.json(
        {
          ok: false,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  /* ---------------------------------------
     Completed but still unpaid
  --------------------------------------- */

  if (
    event.type ===
      "checkout.session.completed"
  ) {
    /*
     * Some payment methods can finish
     * asynchronously.
     *
     * Do not mark success until Stripe
     * reports the payment as paid.
     */
    return NextResponse.json({
      ok: true,
    });
  }

  /* ---------------------------------------
     FAILED / EXPIRED
  --------------------------------------- */

  if (
    payment.status ===
    "succeeded"
  ) {
    /*
     * Never downgrade a successfully
     * confirmed payment.
     */
    return NextResponse.json({
      ok: true,
    });
  }

  const cancelled =
    event.type ===
    "checkout.session.expired";

  const {
    error:
      paymentUpdateError,
  } =
    await supabaseAdmin
      .from(
        "payments",
      )
      .update({
        status:
          cancelled
            ? "cancelled"
            : "failed",

        provider_event_id:
          event.id,

        failure_code:
          cancelled
            ? "STRIPE_SESSION_EXPIRED"
            : "STRIPE_PAYMENT_FAILED",

        failure_message:
          cancelled
            ? "Stripe Checkout expired before payment was completed."
            : "Stripe did not complete the payment.",

        failed_at:
          cancelled
            ? null
            : now,
      })
      .eq(
        "id",
        payment.id,
      );

  if (
    paymentUpdateError
  ) {
    console.error(
      "Stripe failure reconciliation failed.",
    );

    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 500,
      },
    );
  }

  await supabaseAdmin
    .from(
      "placement_requests",
    )
    .update({
      status:
        "offered",
    })
    .eq(
      "id",
      payment
        .placement_request_id,
    );

  return NextResponse.json({
    ok: true,
  });
}