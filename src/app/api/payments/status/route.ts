import {
  NextResponse,
} from "next/server";

import {
  paymentStatusSchema,
} from "@/lib/payments/schemas";

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
  if (
    !isSameOrigin(
      request,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Cross-origin requests are not allowed.",
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
          "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const validation =
    paymentStatusSchema.safeParse(
      body,
    );

  if (
    !validation.success
  ) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Submission ID is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    submissionId,
  } =
    validation.data;

  /* ---------------------------------------
     Application
  --------------------------------------- */

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
          application_reference
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
      "Payment status application lookup failed.",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Payment status could not be checked.",
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

  /* ---------------------------------------
     Placement Request
  --------------------------------------- */

  const {
    data:
      placement,

    error:
      placementError,
  } =
    await supabaseAdmin
      .from(
        "placement_requests",
      )
      .select(
        `
          id,
          status
        `,
      )
      .eq(
        "application_id",
        application.id,
      )
      .maybeSingle();

  if (
    placementError
  ) {
    console.error(
      "Payment status placement lookup failed.",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Payment status could not be checked.",
      },
      {
        status: 500,
      },
    );
  }

  if (!placement) {
    return NextResponse.json({
      ok: true,

      applicationReference:
        application.application_reference,

      placement: {
        exists:
          false,

        status:
          null,
      },

      payment:
        null,
    });
  }

  /* ---------------------------------------
     Most Recent Payment Attempt
  --------------------------------------- */

  const {
    data:
      payments,

    error:
      paymentError,
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
          initiated_at,
          confirmed_at,
          failed_at
        `,
      )
      .eq(
        "placement_request_id",
        placement.id,
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
    paymentError
  ) {
    console.error(
      "Payment status lookup failed.",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Payment status could not be checked.",
      },
      {
        status: 500,
      },
    );
  }

  const payment =
    payments?.[0] ??
    null;

  return NextResponse.json({
    ok: true,

    applicationReference:
      application.application_reference,

    placement: {
      exists:
        true,

      status:
        placement.status,

      completed:
        [
          "paid",
          "distribution_pending",
          "distributed",
        ].includes(
          placement.status,
        ),
    },

    payment:
      payment
        ? {
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

            confirmedAt:
              payment.confirmed_at,

            failedAt:
              payment.failed_at,
          }
        : null,
  });
}