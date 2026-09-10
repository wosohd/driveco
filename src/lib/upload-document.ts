"use client";

import type {
  DocumentType,
} from "@/lib/document-upload-schema";

import {
  supabaseBrowser,
} from "@/lib/supabase/browser";

type SignedUploadResponse = {
  ok: true;

  upload: {
    bucket: string;

    path: string;

    token: string;

    contentType: string;
  };
};

type UploadErrorResponse = {
  ok: false;

  code?: string;

  message?: string;

  errors?: Record<
    string,
    string[]
  >;
};

export type UploadedDocument = {
  documentType:
    DocumentType;

  path:
    string;
};

export async function uploadDocument(
  file: File,

  documentType:
    DocumentType,

  submissionId:
    string,
): Promise<UploadedDocument> {
  /* ---------------------------------------
     Request signed upload token
  --------------------------------------- */

  const signingResponse =
    await fetch(
      "/api/uploads/sign",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            submissionId,

            documentType,

            fileName:
              file.name,

            fileType:
              file.type,

            fileSize:
              file.size,
          }),
      },
    );

  let signingResult:
    | SignedUploadResponse
    | UploadErrorResponse;

  try {
    signingResult =
      (await signingResponse.json()) as
        | SignedUploadResponse
        | UploadErrorResponse;
  } catch {
    throw new Error(
      "DriveCo received an invalid upload response. Please try again.",
    );
  }

  if (
    !signingResponse.ok
  ) {
    if (
      !signingResult.ok
    ) {
      throw new Error(
        signingResult.message ??
          "The upload could not be prepared.",
      );
    }

    throw new Error(
      "The upload could not be prepared.",
    );
  }

  if (
    !signingResult.ok
  ) {
    throw new Error(
      signingResult.message ??
        "The upload could not be prepared.",
    );
  }

  const {
    bucket,
    path,
    token,
    contentType,
  } =
    signingResult.upload;

  /* ---------------------------------------
     Private direct upload
  --------------------------------------- */

  const {
    error,
  } =
    await supabaseBrowser.storage
      .from(bucket)
      .uploadToSignedUrl(
        path,
        token,
        file,
        {
          contentType,

          cacheControl:
            "3600",
        },
      );

  if (error) {
    throw new Error(
      "The document could not be uploaded. Please try again.",
    );
  }

  return {
    documentType,

    path,
  };
}