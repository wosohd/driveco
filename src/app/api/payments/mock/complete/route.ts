import {
  randomUUID,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  mockCompletePaymentSchema,
} from "@/lib/payments/schemas";

import {
  paymentMode,
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
      paymentMode !==
      "mock"
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Mock payments are not enabled.",
        },
        {
          status: 403,
        },
      );
    }

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
      mockCompletePaymentSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The mock payment result is invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      paymentId,
      outcome,
    } =
      validation.data;

    /* ---------------------------------------
       Locate Payment
    --------------------------------------- */

    const {
      data: payment,
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
            status,
            provider_reference
          `,
        )
        .eq(
          "id",
          paymentId,
        )
        .maybeSingle();

    if (
      paymentLookupError
    ) {
      console.error(
        "Mock payment lookup failed:",
        paymentLookupError.message,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The payment could not be checked.",
        },
        {
          status: 500,
        },
      );
    }

    if (!payment) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Payment attempt not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      payment.status ===
      "succeeded"
    ) {
      return NextResponse.json({
        ok: true,

        payment: {
          id:
            payment.id,

          provider:
            payment.provider,

          status:
            "succeeded",

          reference:
            payment.provider_reference,
        },

        placementStatus:
          "distribution_pending",
      });
    }

    if (
      payment.status !==
      "pending"
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "This payment attempt has already been finalized.",
        },
        {
          status: 409,
        },
      );
    }

    /* ---------------------------------------
       Build Mock Result
    --------------------------------------- */

    const now =
      new Date().toISOString();

    const eventReference =
      `MOCK-EVENT-${randomUUID()}`;

    let paymentUpdate:
      Record<
        string,
        string | null
      >;

    let placementStatus:
      string;

    if (
      outcome ===
      "succeeded"
    ) {
      paymentUpdate = {
        status:
          "succeeded",

        confirmed_at:
          now,

        failed_at:
          null,

        failure_code:
          null,

        failure_message:
          null,

        provider_event_id:
          eventReference,
      };

      placementStatus =
        "distribution_pending";
    } else if (
      outcome ===
      "failed"
    ) {
      paymentUpdate = {
        status:
          "failed",

        confirmed_at:
          null,

        failed_at:
          now,

        failure_code:
          "MOCK_PAYMENT_FAILED",

        failure_message:
          "Mock provider payment failure.",

        provider_event_id:
          eventReference,
      };

      placementStatus =
        "offered";
    } else {
      paymentUpdate = {
        status:
          "cancelled",

        confirmed_at:
          null,

        failed_at:
          null,

        failure_code:
          "MOCK_PAYMENT_CANCELLED",

        failure_message:
          "Mock payment cancelled by applicant.",

        provider_event_id:
          eventReference,
      };

      placementStatus =
        "offered";
    }

    /* ---------------------------------------
       Update Payment
    --------------------------------------- */

    const {
      data:
        updatedPayment,

      error:
        paymentUpdateError,
    } =
      await supabaseAdmin
        .from(
          "payments",
        )
        .update(
          paymentUpdate,
        )
        .eq(
          "id",
          payment.id,
        )
        .select(
          `
            id,
            provider,
            status,
            provider_reference,
            confirmed_at,
            failed_at
          `,
        )
        .single();

    if (
      paymentUpdateError ||
      !updatedPayment
    ) {
      console.error(
        "Mock payment update failed:",
        paymentUpdateError?.message,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The mock payment could not be completed.",
        },
        {
          status: 500,
        },
      );
    }

    /* ---------------------------------------
       Update Placement
    --------------------------------------- */

    const {
      error:
        placementUpdateError,
    } =
      await supabaseAdmin
        .from(
          "placement_requests",
        )
        .update({
          status:
            placementStatus,
        })
        .eq(
          "id",
          payment.placement_request_id,
        );

    if (
      placementUpdateError
    ) {
      console.error(
        "Placement status update failed:",
        placementUpdateError.message,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The payment was recorded but the placement status could not be updated.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,

      payment: {
        id:
          updatedPayment.id,

        provider:
          updatedPayment.provider,

        status:
          updatedPayment.status,

        reference:
          updatedPayment.provider_reference,
      },

      placementStatus,
    });
  } catch (error) {
    console.error(
      "Unexpected mock payment error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "An unexpected mock payment error occurred.",
      },
      {
        status: 500,
      },
    );
  }
}