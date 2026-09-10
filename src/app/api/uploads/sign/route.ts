import {
  NextResponse,
} from "next/server";

import {
  DOCUMENT_BUCKET,
  getCanonicalMimeType,
  getFileExtension,
  uploadSigningSchema,
} from "@/lib/document-upload-schema";

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
    /* ---------------------------------------
       Origin protection
    --------------------------------------- */

    if (
      !isSameOrigin(
        request,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Cross-origin upload requests are not allowed.",
        },
        {
          status: 403,
        },
      );
    }

    const contentType =
      request.headers.get(
        "content-type",
      );

    if (
      !contentType?.includes(
        "application/json",
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Content-Type must be application/json.",
        },
        {
          status: 415,
        },
      );
    }

    /* ---------------------------------------
       Parse JSON
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

    /* ---------------------------------------
       Validate metadata
    --------------------------------------- */

    const validation =
      uploadSigningSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The selected file is not valid.",

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

    const upload =
      validation.data;

    /* ---------------------------------------
       Prevent modification after submission
    --------------------------------------- */

    const {
      data:
        existingApplications,

      error:
        existingError,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .select("id")
        .eq(
          "submission_id",
          upload.submissionId,
        )
        .limit(1);

    if (existingError) {
      console.error(
        "Submission lookup failed during upload signing:",
        existingError.message,
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The secure upload could not be prepared. Please try again.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      existingApplications &&
      existingApplications.length >
        0
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "ALREADY_SUBMITTED",

          message:
            "This application has already been submitted.",
        },
        {
          status: 409,
        },
      );
    }

    /* ---------------------------------------
       Resolve extension
    --------------------------------------- */

    const extension =
      getFileExtension(
        upload.fileName,
      );

    const canonicalMimeType =
      getCanonicalMimeType(
        upload.fileName,
      );

    if (
      !extension ||
      !canonicalMimeType
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The selected file type is not supported.",
        },
        {
          status: 400,
        },
      );
    }

    /* ---------------------------------------
       Deterministic private path
    --------------------------------------- */

    const objectPath =
      `pending/${upload.submissionId}/` +
      `${upload.documentType}.${extension}`;

    /* ---------------------------------------
       Signed upload token
    --------------------------------------- */

    const {
      data,
      error,
    } =
      await supabaseAdmin.storage
        .from(
          DOCUMENT_BUCKET,
        )
        .createSignedUploadUrl(
          objectPath,
          {
            /*
             * Retry attempts may safely
             * overwrite the same pending
             * object before submission.
             */
            upsert: true,
          },
        );

    if (
      error ||
      !data
    ) {
      console.error(
        "Signed upload creation failed:",
        {
          documentType:
            upload.documentType,

          message:
            error?.message,
        },
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "A secure upload could not be prepared. Please try again.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,

        upload: {
          bucket:
            DOCUMENT_BUCKET,

          path:
            objectPath,

          token:
            data.token,

          contentType:
            canonicalMimeType,
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Unexpected upload signing error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "An unexpected error occurred while preparing the upload.",
      },
      {
        status: 500,
      },
    );
  }
}