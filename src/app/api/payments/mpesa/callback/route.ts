import {
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

type CallbackItem = {
  Name?: string;

  Value?:
    | string
    | number;
};

type MpesaCallback = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;

      CheckoutRequestID?: string;

      ResultCode?: number;

      ResultDesc?: string;

      CallbackMetadata?: {
        Item?: CallbackItem[];
      };
    };
  };
};

function getMetadataValue(
  items:
    CallbackItem[],

  name:
    string,
) {
  return items.find(
    (item) =>
      item.Name ===
      name,
  )?.Value;
}

export async function POST(
  request: Request,
) {
  let body:
    MpesaCallback;

  try {
    body =
      (await request.json()) as
        MpesaCallback;
  } catch {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const callback =
    body.Body
      ?.stkCallback;

  if (
    !callback ||
    !callback
      .CheckoutRequestID ||
    typeof callback
      .ResultCode !==
      "number"
  ) {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 400,
      },
    );
  }

  const checkoutRequestId =
    callback.CheckoutRequestID;

  /* ---------------------------------------
     Locate Exact Pending Payment
  --------------------------------------- */

  const {
    data:
      payment,

    error:
      lookupError,
  } =
    await supabaseAdmin
      .from(
        "payments",
      )
      .select(
        `
          id,
          placement_request_id,
          amount_kes,
          currency,
          status,
          provider_reference,
          provider_event_id
        `,
      )
      .eq(
        "provider",
        "mpesa",
      )
      .eq(
        "provider_checkout_id",
        checkoutRequestId,
      )
      .maybeSingle();

  if (
    lookupError
  ) {
    console.error(
      "M-Pesa callback lookup failed.",
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

  /*
   * Return 200 for an unknown provider
   * callback so we don't encourage
   * repeated provider deliveries.
   *
   * Nothing is written to the DB.
   */
  if (!payment) {
    return NextResponse.json({
      ok: true,
    });
  }

  /*
   * Provider callbacks can be
   * delivered more than once.
   */
  if (
    [
      "succeeded",
      "failed",
      "cancelled",
      "refunded",
    ].includes(
      payment.status,
    )
  ) {
    return NextResponse.json({
      ok: true,
    });
  }

  const eventId =
    `mpesa:${checkoutRequestId}:${callback.ResultCode}`;

  /* ---------------------------------------
     Failed / Cancelled STK Result
  --------------------------------------- */

  if (
    callback.ResultCode !==
    0
  ) {
    const now =
      new Date()
        .toISOString();

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
            "failed",

          provider_event_id:
            eventId,

          failure_code:
            `MPESA_${callback.ResultCode}`,

          failure_message:
            "M-Pesa did not complete the payment.",

          failed_at:
            now,
        })
        .eq(
          "id",
          payment.id,
        );

    if (
      updateError
    ) {
      console.error(
        "M-Pesa failure reconciliation failed.",
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

  /* ---------------------------------------
     Successful STK Result
  --------------------------------------- */

  const items =
    callback
      .CallbackMetadata
      ?.Item ??
    [];

  const amount =
    getMetadataValue(
      items,
      "Amount",
    );

  const receipt =
    getMetadataValue(
      items,
      "MpesaReceiptNumber",
    );

  /*
   * Never trust callback success alone.
   * The paid amount must match the
   * amount DriveCo expected.
   */
  const numericAmount =
    typeof amount ===
      "number"
      ? amount
      : Number(amount);

  if (
    !Number.isFinite(
      numericAmount,
    ) ||
    numericAmount !==
      Number(
        payment.amount_kes,
      ) ||
    typeof receipt !==
      "string" ||
    !receipt
  ) {
    console.error(
      "M-Pesa callback amount or receipt validation failed.",
    );

    await supabaseAdmin
      .from(
        "payments",
      )
      .update({
        status:
          "failed",

        provider_event_id:
          eventId,

        failure_code:
          "MPESA_CALLBACK_MISMATCH",

        failure_message:
          "M-Pesa callback validation failed.",

        failed_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        payment.id,
      );

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

  const now =
    new Date()
      .toISOString();

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
          "succeeded",

        provider_reference:
          receipt,

        provider_event_id:
          eventId,

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
    paymentUpdateError
  ) {
    console.error(
      "M-Pesa success reconciliation failed.",
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
          "distribution_pending",
      })
      .eq(
        "id",
        payment
          .placement_request_id,
      );

  if (
    placementUpdateError
  ) {
    console.error(
      "M-Pesa placement reconciliation failed.",
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