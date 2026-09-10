import {
  NextResponse,
} from "next/server";

import {
  applicationSubmissionSchema,
} from "@/lib/application-submission-schema";

import {
  DOCUMENT_BUCKET,
  DOCUMENT_RULES,
  getFileExtension,
  type DocumentType,
} from "@/lib/document-upload-schema";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime =
  "nodejs";

type DocumentVerificationResult =
  | {
      ok: true;
    }
  | {
      ok: false;

      message: string;
    };

const UUID_PATTERN =
  "[0-9a-f]{8}-" +
  "[0-9a-f]{4}-" +
  "[0-9a-f]{4}-" +
  "[0-9a-f]{4}-" +
  "[0-9a-f]{12}";

function pathMatchesDocumentType(
  path: string,

  documentType:
    DocumentType,

  submissionId:
    string,
) {
  const rule =
    DOCUMENT_RULES[
      documentType
    ];

  const extensions =
    rule.allowedExtensions.join(
      "|",
    );

  const pattern =
    new RegExp(
      `^pending/${submissionId}/${documentType}\\.(${extensions})$`,
      "i",
    );

  return pattern.test(
    path,
  );
}

async function verifyStoredDocument(
  documentType:
    DocumentType,

  path:
    string,

  submissionId:
    string,
): Promise<DocumentVerificationResult> {
  if (
    !pathMatchesDocumentType(
      path,
      documentType,
      submissionId,
    )
  ) {
    return {
      ok: false,

      message:
        "The document path is invalid.",
    };
  }

  const extension =
    getFileExtension(
      path,
    );

  const rule =
    DOCUMENT_RULES[
      documentType
    ];

  if (
    !extension ||
    !rule.allowedExtensions.includes(
      extension,
    )
  ) {
    return {
      ok: false,

      message:
        "The document extension is invalid.",
    };
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.storage
      .from(
        DOCUMENT_BUCKET,
      )
      .info(path);

  if (
    error ||
    !data
  ) {
    return {
      ok: false,

      message:
        "The uploaded document could not be found.",
    };
  }

  const size =
    Number(
      data.size,
    );

  if (
    !Number.isFinite(
      size,
    ) ||
    size <= 0 ||
    size >
      rule.maxSize
  ) {
    return {
      ok: false,

      message:
        "The uploaded document has an invalid size.",
    };
  }

  const contentType =
    data.contentType;

  if (
    !contentType ||
    !rule.allowedMimeTypes.includes(
      contentType,
    )
  ) {
    return {
      ok: false,

      message:
        "The uploaded document has an invalid file type.",
    };
  }

  return {
    ok: true,
  };
}

async function findExistingApplication(
  submissionId:
    string,
) {
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
    return {
      application:
        null,

      error,
    };
  }

  const existing =
    data?.[0];

  return {
    application:
      existing
        ? {
            reference:
              existing.application_reference,

            status:
              existing.status,

            createdAt:
              existing.created_at,
          }
        : null,

    error: null,
  };
}

export async function POST(
  request: Request,
) {
  try {
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

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The request body contains invalid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    const validation =
      applicationSubmissionSchema.safeParse(
        body,
      );

    if (
      !validation.success
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Please correct the invalid application fields.",

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

    const application =
      validation.data;

    /* ---------------------------------------
       Fast idempotency check
    --------------------------------------- */

    const existingLookup =
      await findExistingApplication(
        application.submissionId,
      );

    if (
      existingLookup.error
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "The application could not be checked. Please try again.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      existingLookup.application
    ) {
      return NextResponse.json(
        {
          ok: true,

          message:
            "Application already submitted.",

          application:
            existingLookup.application,
        },
        {
          status: 200,
        },
      );
    }

    /* ---------------------------------------
       Verify documents
    --------------------------------------- */

    const documentChecks =
      await Promise.all([
        verifyStoredDocument(
          "nationalIdImage",

          application.documents
            .nationalIdImage,

          application.submissionId,
        ),

        verifyStoredDocument(
          "drivingLicenceImage",

          application.documents
            .drivingLicenceImage,

          application.submissionId,
        ),

        verifyStoredDocument(
          "cv",

          application.documents.cv,

          application.submissionId,
        ),

        application.documents
          .profilePhoto
          ? verifyStoredDocument(
              "profilePhoto",

              application.documents
                .profilePhoto,

              application.submissionId,
            )
          : Promise.resolve({
              ok: true,
            } as const),
      ]);

    const invalidDocument =
      documentChecks.find(
        (result) =>
          !result.ok,
      );

    if (
      invalidDocument &&
      !invalidDocument.ok
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "One or more uploaded documents could not be verified. Please upload the documents again.",
        },
        {
          status: 400,
        },
      );
    }

    /* ---------------------------------------
       Insert
    --------------------------------------- */

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "applications",
        )
        .insert({
          submission_id:
            application.submissionId,

          full_name:
            application.fullName,

          email:
            application.email,

          phone:
            application.phone,

          country:
            application.country,

          nationality:
            "Kenyan",

          national_id:
            application.nationalId,

          marital_status:
            application.maritalStatus,

          education_level:
            application.educationLevel,

          licence_number:
            application.licenceNumber,

          licence_category:
            application.licenceCategory,

          driving_experience:
            application.drivingExperience,

          previous_employer:
            application.previousEmployer ||
            null,

          employment_status:
            application.employmentStatus,

          availability:
            application.availability,

          national_id_file_path:
            application.documents
              .nationalIdImage,

          driving_licence_file_path:
            application.documents
              .drivingLicenceImage,

          cv_file_path:
            application.documents
              .cv,

          profile_photo_path:
            application.documents
              .profilePhoto ??
            null,

          applicant_declaration:
            application
              .applicantDeclaration,

          privacy_consent:
            application
              .privacyConsent,

          status:
            "submitted",
        })
        .select(
          `
            application_reference,
            status,
            created_at
          `,
        )
        .single();

    /* ---------------------------------------
       Concurrent duplicate recovery
    --------------------------------------- */

    if (
      error?.code ===
      "23505"
    ) {
      const duplicateLookup =
        await findExistingApplication(
          application.submissionId,
        );

      if (
        duplicateLookup.application
      ) {
        return NextResponse.json(
          {
            ok: true,

            message:
              "Application already submitted.",

            application:
              duplicateLookup.application,
          },
          {
            status: 200,
          },
        );
      }
    }

    if (
      error ||
      !data
    ) {
      console.error(
        "Application database insert failed:",
        {
          code:
            error?.code,

          message:
            error?.message,
        },
      );

      return NextResponse.json(
        {
          ok: false,

          message:
            "The application could not be saved. Please try again.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,

        message:
          "Application submitted successfully.",

        application: {
          reference:
            data.application_reference,

          status:
            data.status,

          createdAt:
            data.created_at,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Unexpected application submission error:",
      error instanceof Error
        ? error.message
        : "Unknown server error",
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "An unexpected error occurred while processing the application.",
      },
      {
        status: 500,
      },
    );
  }
}