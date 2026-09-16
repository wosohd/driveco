import {
  randomUUID,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  initiatePaymentSchema,
} from "@/lib/payments/schemas";

import {
  externalPaymentsEnabled,
  paymentMode,
  PLACEMENT_SERVICE,
} from "@/lib/payments/config";

import {
  initiateMpesaStkPush,
} from "@/lib/payments/providers/mpesa";

import {
  createStripeCheckout,
  getStripeClient,
} from "@/lib/payments/providers/stripe";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

function isSameOrigin(
  request: Request,
) {
  const origin =
    request.headers.get(
      "origin",
    );

  const host =
    request.headers.get(
      "host",
    );

  if (!origin) {
    return true;
  }

  if (!host) {
    return false;
  }

  try {
    return (
      new URL(origin).host ===
      host
    );
  } catch {
    return false;
  }
}

async function returnPlacementToOffered(
  placementRequestId:
    string,
) {
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
      placementRequestId,
    );
}

function providerLabel(
  provider:
    string,
) {
  return provider ===
    "mpesa"
    ? "M-Pesa"
    : "Stripe";
}

export async function POST(
  request: Request,
) {
  try {
    if (
      !isSameOrigin(
        request,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Cross-origin payment requests are not allowed.",
        },
        {
          status: 403,
        },
      );
    }

    if (
      paymentMode ===
      "disabled"
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "PAYMENTS_DISABLED",

          message:
            "Payment processing is currently disabled.",
        },
        {
          status: 403,
        },
      );
    }

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The request contains invalid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    const validation =
      initiatePaymentSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The payment request is invalid.",

          errors:
            validation.error
              .flatten()
              .fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    const {
      submissionId,
      provider,
      phoneNumber,
    } =
      validation.data;

    if (
      externalPaymentsEnabled &&
      provider ===
        "mpesa" &&
      !phoneNumber
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Enter the M-Pesa phone number that should receive the payment prompt.",
        },
        {
          status: 400,
        },
      );
    }

    /* -----------------------------------
       Application
    ----------------------------------- */

    const {
      data:
        application,

      error:
        applicationError,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .select(
          `
            id,
            application_reference,
            email,
            status
          `,
        )
        .eq(
          "submission_id",
          submissionId,
        )
        .maybeSingle();

    if (
      applicationError
    ) {
      console.error(
        "Payment application lookup failed.",
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The application could not be verified.",
        },
        {
          status: 500,
        },
      );
    }

    if (!application) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Application not found.",
        },
        {
          status: 404,
        },
      );
    }

    /* -----------------------------------
       Placement Request
    ----------------------------------- */

    const {
      data:
        existingPlacement,

      error:
        placementLookupError,
    } =
      await supabaseAdmin
        .from(
          "placement_requests",
        )
        .select(
          `
            id,
            status,
            service_consent
          `,
        )
        .eq(
          "application_id",
          application.id,
        )
        .maybeSingle();

    if (
      placementLookupError
    ) {
      console.error(
        "Placement lookup failed.",
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The placement service could not be prepared.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      existingPlacement &&
      [
        "paid",
        "distribution_pending",
        "distributed",
      ].includes(
        existingPlacement.status,
      )
    ) {
      return NextResponse.json({
        ok: true,

        alreadyCompleted:
          true,

        placement: {
          id:
            existingPlacement.id,

          status:
            existingPlacement.status,
        },
      });
    }

    const consentTime =
      new Date()
        .toISOString();

    let placementRequest:
      {
        id: string;
        status: string;
      };

    if (
      existingPlacement
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "placement_requests",
          )
          .update({
            service_consent:
              true,

            service_consent_at:
              consentTime,

            status:
              "payment_pending",
          })
          .eq(
            "id",
            existingPlacement.id,
          )
          .select(
            `
              id,
              status
            `,
          )
          .single();

      if (
        error ||
        !data
      ) {
        console.error(
          "Placement request update failed.",
        );

        return NextResponse.json(
          {
            ok: false,

            message:
              "The placement request could not be updated.",
          },
          {
            status: 500,
          },
        );
      }

      placementRequest =
        data;
    } else {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "placement_requests",
          )
          .insert({
            application_id:
              application.id,

            service_code:
              PLACEMENT_SERVICE.code,

            amount_kes:
              PLACEMENT_SERVICE.amountKes,

            currency:
              PLACEMENT_SERVICE.currency,

            status:
              "payment_pending",

            service_consent:
              true,

            service_consent_at:
              consentTime,
          })
          .select(
            `
              id,
              status
            `,
          )
          .single();

      if (
        error ||
        !data
      ) {
        console.error(
          "Placement request creation failed.",
        );

        return NextResponse.json(
          {
            ok: false,

            message:
              "The placement request could not be created.",
          },
          {
            status: 500,
          },
        );
      }

      placementRequest =
        data;
    }

    /* -----------------------------------
       ANY Existing Active Attempt
    ----------------------------------- */

    const {
      data:
        activeAttempts,

      error:
        activeLookupError,
    } =
      await supabaseAdmin
        .from(
          "payments",
        )
        .select(
          `
            id,
            provider,
            status,
            provider_reference,
            provider_checkout_id,
            initiated_at
          `,
        )
        .eq(
          "placement_request_id",
          placementRequest.id,
        )
        .in(
          "status",
          [
            "created",
            "pending",
          ],
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        )
        .limit(1);

    if (
      activeLookupError
    ) {
      console.error(
        "Active payment lookup failed.",
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The payment attempt could not be prepared.",
        },
        {
          status: 500,
        },
      );
    }

    const activePayment =
      activeAttempts?.[0];

    /* -----------------------------------
       Different Provider Already Active
    ----------------------------------- */

    if (
      activePayment &&
      activePayment.provider !==
        provider
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "PAYMENT_ALREADY_PENDING",

          activeProvider:
            activePayment.provider,

          message:
            `A ${providerLabel(
              activePayment.provider,
            )} payment is already awaiting completion. Complete or resolve that payment before starting another payment method.`,
        },
        {
          status: 409,
        },
      );
    }

    /* -----------------------------------
       Reuse Same Active Attempt
    ----------------------------------- */

    if (
      activePayment
    ) {
      if (
        paymentMode ===
        "mock"
      ) {
        return NextResponse.json({
          ok: true,

          reused:
            true,

          mode:
            paymentMode,

          placement: {
            id:
              placementRequest.id,

            status:
              placementRequest.status,
          },

          payment: {
            id:
              activePayment.id,

            provider:
              activePayment.provider,

            status:
              activePayment.status,

            reference:
              activePayment.provider_reference,

            initiatedAt:
              activePayment.initiated_at,
          },
        });
      }

      if (
        provider ===
          "stripe" &&
        activePayment
          .provider_checkout_id
      ) {
        try {
          const stripe =
            getStripeClient();

          const session =
            await stripe
              .checkout
              .sessions
              .retrieve(
                activePayment
                  .provider_checkout_id,
              );

          if (
            session.status ===
              "open" &&
            session.url
          ) {
            return NextResponse.json({
              ok: true,

              reused:
                true,

              mode:
                paymentMode,

              placement: {
                id:
                  placementRequest.id,

                status:
                  placementRequest.status,
              },

              payment: {
                id:
                  activePayment.id,

                provider:
                  "stripe",

                status:
                  activePayment.status,

                reference:
                  activePayment.provider_reference,
              },

              stripe: {
                checkoutUrl:
                  session.url,
              },
            });
          }
        } catch {
          console.error(
            "Existing Stripe Checkout lookup failed.",
          );
        }
      }

      if (
        provider ===
          "mpesa" &&
        activePayment
          .provider_checkout_id
      ) {
        return NextResponse.json({
          ok: true,

          reused:
            true,

          mode:
            paymentMode,

          placement: {
            id:
              placementRequest.id,

            status:
              placementRequest.status,
          },

          payment: {
            id:
              activePayment.id,

            provider:
              "mpesa",

            status:
              activePayment.status,

            reference:
              activePayment.provider_reference,
          },

          mpesa: {
            message:
              "An M-Pesa payment request is already awaiting confirmation.",
          },
        });
      }

      return NextResponse.json(
        {
          ok: false,

          code:
            "PAYMENT_ALREADY_PENDING",

          activeProvider:
            activePayment.provider,

          message:
            "A payment attempt is already awaiting completion.",
        },
        {
          status: 409,
        },
      );
    }

    /* -----------------------------------
       MOCK
    ----------------------------------- */

    if (
      paymentMode ===
      "mock"
    ) {
      const providerReference =
        `MOCK-${provider.toUpperCase()}-${randomUUID()}`;

      const {
        data:
          payment,

        error:
          paymentError,
      } =
        await supabaseAdmin
          .from(
            "payments",
          )
          .insert({
            placement_request_id:
              placementRequest.id,

            provider,

            amount_kes:
              PLACEMENT_SERVICE.amountKes,

            currency:
              PLACEMENT_SERVICE.currency,

            status:
              "pending",

            idempotency_key:
              randomUUID(),

            provider_reference:
              providerReference,
          })
          .select(
            `
              id,
              provider,
              status,
              provider_reference,
              initiated_at
            `,
          )
          .single();

      if (
        paymentError ||
        !payment
      ) {
        console.error(
          "Mock payment creation failed.",
        );

        return NextResponse.json(
          {
            ok: false,

            message:
              "The payment attempt could not be created.",
          },
          {
            status:
              paymentError
                ?.code ===
              "23505"
                ? 409
                : 500,
          },
        );
      }

      return NextResponse.json(
        {
          ok: true,

          mode:
            "mock",

          placement: {
            id:
              placementRequest.id,

            status:
              placementRequest.status,
          },

          payment: {
            id:
              payment.id,

            provider:
              payment.provider,

            status:
              payment.status,

            reference:
              payment.provider_reference,

            initiatedAt:
              payment.initiated_at,
          },
        },
        {
          status: 201,
        },
      );
    }

    /* -----------------------------------
       External Payment Record
    ----------------------------------- */

    const {
      data:
        payment,

      error:
        paymentCreateError,
    } =
      await supabaseAdmin
        .from(
          "payments",
        )
        .insert({
          placement_request_id:
            placementRequest.id,

          provider,

          amount_kes:
            PLACEMENT_SERVICE.amountKes,

          currency:
            PLACEMENT_SERVICE.currency,

          status:
            "created",

          idempotency_key:
            randomUUID(),
        })
        .select(
          `
            id,
            provider,
            status
          `,
        )
        .single();

    if (
      paymentCreateError ||
      !payment
    ) {
      console.error(
        "Payment record creation failed.",
      );

      return NextResponse.json(
        {
          ok: false,

          code:
            paymentCreateError
              ?.code ===
              "23505"
              ? "PAYMENT_ALREADY_PENDING"
              : "PAYMENT_CREATE_FAILED",

          message:
            paymentCreateError
              ?.code ===
              "23505"
              ? "Another payment attempt is already awaiting completion."
              : "The payment attempt could not be created.",
        },
        {
          status:
            paymentCreateError
              ?.code ===
              "23505"
              ? 409
              : 500,
        },
      );
    }

    /* -----------------------------------
       M-PESA
    ----------------------------------- */

    if (
      provider ===
      "mpesa"
    ) {
      try {
        const result =
          await initiateMpesaStkPush({
            phoneNumber:
              phoneNumber!,

            amountKes:
              PLACEMENT_SERVICE.amountKes,

            accountReference:
              application.application_reference,

            description:
              "DriveCo placement",
          });

        if (
          !result.accepted ||
          !result.checkoutRequestId
        ) {
          await supabaseAdmin
            .from(
              "payments",
            )
            .update({
              status:
                "failed",

              failure_code:
                "MPESA_REJECTED",

              failure_message:
                "M-Pesa rejected the payment initiation request.",

              failed_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              payment.id,
            );

          await returnPlacementToOffered(
            placementRequest.id,
          );

          return NextResponse.json(
            {
              ok: false,

              message:
                "M-Pesa could not start the payment. Please try again.",
            },
            {
              status: 502,
            },
          );
        }

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
                "pending",

              provider_checkout_id:
                result.checkoutRequestId,

              provider_reference:
                result.merchantRequestId,
            })
            .eq(
              "id",
              payment.id,
            );

        if (
          paymentUpdateError
        ) {
          console.error(
            "M-Pesa payment reconciliation setup failed.",
          );

          return NextResponse.json(
            {
              ok: false,

              message:
                "The M-Pesa request was created but DriveCo could not prepare payment tracking.",
            },
            {
              status: 500,
            },
          );
        }

        return NextResponse.json(
          {
            ok: true,

            mode:
              paymentMode,

            placement: {
              id:
                placementRequest.id,

              status:
                "payment_pending",
            },

            payment: {
              id:
                payment.id,

              provider:
                "mpesa",

              status:
                "pending",

              reference:
                result.merchantRequestId,
            },

            mpesa: {
              message:
                result.message,
            },
          },
          {
            status: 201,
          },
        );
      } catch {
        console.error(
          "M-Pesa initiation failed.",
        );

        await supabaseAdmin
          .from(
            "payments",
          )
          .update({
            status:
              "failed",

            failure_code:
              "MPESA_INITIATION_FAILED",

            failure_message:
              "M-Pesa payment initiation failed.",

            failed_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            payment.id,
          );

        await returnPlacementToOffered(
          placementRequest.id,
        );

        return NextResponse.json(
          {
            ok: false,

            message:
              "The M-Pesa payment could not be started.",
          },
          {
            status: 502,
          },
        );
      }
    }

    /* -----------------------------------
       STRIPE
    ----------------------------------- */

    try {
      const checkout =
        await createStripeCheckout({
          paymentId:
            payment.id,

          placementRequestId:
            placementRequest.id,

          submissionId,

          applicationReference:
            application.application_reference,

          customerEmail:
            application.email ??
            null,
        });

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
              "pending",

            provider_checkout_id:
              checkout.sessionId,
          })
          .eq(
            "id",
            payment.id,
          );

      if (
        paymentUpdateError
      ) {
        console.error(
          "Stripe payment reconciliation setup failed.",
        );

        return NextResponse.json(
          {
            ok: false,

            message:
              "Stripe Checkout was created but DriveCo could not prepare payment tracking.",
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json(
        {
          ok: true,

          mode:
            paymentMode,

          placement: {
            id:
              placementRequest.id,

            status:
              "payment_pending",
          },

          payment: {
            id:
              payment.id,

            provider:
              "stripe",

            status:
              "pending",

            reference:
              null,
          },

          stripe: {
            checkoutUrl:
              checkout.checkoutUrl,
          },
        },
        {
          status: 201,
        },
      );
    } catch {
      console.error(
        "Stripe Checkout initiation failed.",
      );

      await supabaseAdmin
        .from(
          "payments",
        )
        .update({
          status:
            "failed",

          failure_code:
            "STRIPE_INITIATION_FAILED",

          failure_message:
            "Stripe Checkout initiation failed.",

          failed_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          payment.id,
        );

      await returnPlacementToOffered(
        placementRequest.id,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "Stripe Checkout could not be started.",
        },
        {
          status: 502,
        },
      );
    }
  } catch {
    console.error(
      "Unexpected payment initiation error.",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "An unexpected payment error occurred.",
      },
      {
        status: 500,
      },
    );
  }
}