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
  paymentMode,
  PLACEMENT_SERVICE,
} from "@/lib/payments/config";

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

    /* ---------------------------------------
       Payment Mode Guard
    --------------------------------------- */

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

    /*
     * Real providers are intentionally
     * unavailable until commercial
     * activation.
     */

    if (
      paymentMode ===
      "live"
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "LIVE_PAYMENTS_NOT_CONFIGURED",

          message:
            "Live payment processing has not yet been activated.",
        },
        {
          status: 501,
        },
      );
    }

    /* ---------------------------------------
       Parse Request
    --------------------------------------- */

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
    } =
      validation.data;

    /* ---------------------------------------
       Find Submitted Application
    --------------------------------------- */

    const {
      data: application,
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
        "Payment application lookup failed:",
        applicationError.message,
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

    if (
      !application
    ) {
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

    /* ---------------------------------------
       Find Existing Placement Request
    --------------------------------------- */

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
        "Placement lookup failed:",
        placementLookupError.message,
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

    /* ---------------------------------------
       Already Paid / Distributed
    --------------------------------------- */

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

    /* ---------------------------------------
       Create / Update Placement Request
    --------------------------------------- */

    const consentTime =
      new Date().toISOString();

    let placementRequest:
      | {
          id: string;
          status: string;
        }
      | null = null;

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
          "Placement request update failed:",
          error?.message,
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
          "Placement request creation failed:",
          error?.message,
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

    /* ---------------------------------------
       Reuse Pending Provider Attempt
    --------------------------------------- */

    const {
      data:
        pendingPayments,

      error:
        pendingLookupError,
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
            initiated_at
          `,
        )
        .eq(
          "placement_request_id",
          placementRequest.id,
        )
        .eq(
          "provider",
          provider,
        )
        .eq(
          "status",
          "pending",
        )
        .limit(1);

    if (
      pendingLookupError
    ) {
      console.error(
        "Pending payment lookup failed:",
        pendingLookupError.message,
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

    const pendingPayment =
      pendingPayments?.[0];

    if (
      pendingPayment
    ) {
      return NextResponse.json({
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
            pendingPayment.id,

          provider:
            pendingPayment.provider,

          status:
            pendingPayment.status,

          reference:
            pendingPayment.provider_reference,

          initiatedAt:
            pendingPayment.initiated_at,
        },
      });
    }

    /* ---------------------------------------
       Create Mock Payment Attempt
    --------------------------------------- */

    const providerReference =
      `MOCK-${provider.toUpperCase()}-${randomUUID()}`;

    const {
      data: payment,
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
        "Mock payment creation failed:",
        paymentError?.message,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The payment attempt could not be created.",
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
  } catch (error) {
    console.error(
      "Unexpected payment initiation error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
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