import {
  NextResponse,
} from "next/server";

import {
  z,
} from "zod";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

const statusSchema =
  z.object({
    submissionId: z
      .string()
      .uuid(
        "Submission ID is invalid.",
      ),
  });

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
            "The request contains invalid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    const validation =
      statusSchema.safeParse(
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

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .select(
          `
            application_reference,
            status,
            created_at
          `,
        )
        .eq(
          "submission_id",
          submissionId,
        )
        .limit(1);

    if (error) {
      console.error(
        "Submission status lookup failed:",
        error.message,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "Application status could not be checked.",
        },
        {
          status: 500,
        },
      );
    }

    const existing =
      data?.[0];

    if (!existing) {
      return NextResponse.json({
        ok: true,

        exists: false,
      });
    }

    return NextResponse.json({
      ok: true,

      exists: true,

      application: {
        reference:
          existing.application_reference,

        status:
          existing.status,

        createdAt:
          existing.created_at,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected submission status error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Application status could not be checked.",
      },
      {
        status: 500,
      },
    );
  }
}