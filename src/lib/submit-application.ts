"use client";

import type {
  ApplicationFormValues,
} from "@/lib/application-schema";

import {
  uploadDocument,
} from "@/lib/upload-document";

export type SubmissionPhase =
  | "uploading"
  | "saving";

export type SubmittedApplication = {
  reference: string;

  status: string;

  createdAt: string;
};

type SuccessfulApplicationResponse = {
  ok: true;

  message: string;

  application:
    SubmittedApplication;
};

type FailedApplicationResponse = {
  ok: false;

  message?: string;

  errors?: Record<
    string,
    string[]
  >;
};

type StatusResponse =
  | {
      ok: true;

      exists: false;
    }
  | {
      ok: true;

      exists: true;

      application:
        SubmittedApplication;
    }
  | {
      ok: false;

      message?: string;
    };

/* ---------------------------------------
   File Helper
--------------------------------------- */

function getFirstFile(
  files:
    | FileList
    | undefined,
) {
  if (
    !files ||
    files.length === 0
  ) {
    return null;
  }

  return files.item(0);
}

/* ---------------------------------------
   Successful Submission Navigation
--------------------------------------- */

function completeApplicationSubmission(
  application:
    SubmittedApplication,

  submissionId:
    string,
) {
  /*
   * Once the free driver application
   * has been successfully stored,
   * continue to the separate optional
   * placement-service page.
   */

  window.location.assign(
    `/placement/${encodeURIComponent(
      submissionId,
    )}`,
  );

  return application;
}

/* ---------------------------------------
   Recover Existing Application
--------------------------------------- */

async function findExistingApplication(
  submissionId:
    string,
): Promise<
  SubmittedApplication | null
> {
  const response =
    await fetch(
      "/api/applications/status",
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
          }),
      },
    );

  let result:
    StatusResponse;

  try {
    result =
      (await response.json()) as
        StatusResponse;
  } catch {
    throw new Error(
      "Application status could not be checked.",
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      !result.ok
        ? result.message ??
            "Application status could not be checked."
        : "Application status could not be checked.",
    );
  }

  if (
    !result.exists
  ) {
    return null;
  }

  return result.application;
}

/* ---------------------------------------
   Main Submission
--------------------------------------- */

export async function submitApplication(
  values:
    ApplicationFormValues,

  submissionId:
    string,

  onPhaseChange?: (
    phase:
      SubmissionPhase,
  ) => void,
): Promise<SubmittedApplication> {
  /* ---------------------------------------
     Recover completed previous attempt
  --------------------------------------- */

  const existing =
    await findExistingApplication(
      submissionId,
    );

  if (existing) {
    return completeApplicationSubmission(
      existing,
      submissionId,
    );
  }

  /* ---------------------------------------
     Resolve Required Files
  --------------------------------------- */

  const nationalIdFile =
    getFirstFile(
      values.nationalIdImage,
    );

  const drivingLicenceFile =
    getFirstFile(
      values.drivingLicenceImage,
    );

  const cvFile =
    getFirstFile(
      values.cv,
    );

  const profilePhotoFile =
    getFirstFile(
      values.profilePhoto,
    );

  if (
    !nationalIdFile ||
    !drivingLicenceFile ||
    !cvFile
  ) {
    throw new Error(
      "The required supporting documents are incomplete.",
    );
  }

  /* ---------------------------------------
     Secure Private Uploads
  --------------------------------------- */

  onPhaseChange?.(
    "uploading",
  );

  let nationalIdUpload:
    Awaited<
      ReturnType<
        typeof uploadDocument
      >
    >;

  let drivingLicenceUpload:
    Awaited<
      ReturnType<
        typeof uploadDocument
      >
    >;

  let cvUpload:
    Awaited<
      ReturnType<
        typeof uploadDocument
      >
    >;

  let profilePhotoUpload:
    Awaited<
      ReturnType<
        typeof uploadDocument
      >
    > | null;

  try {
    [
      nationalIdUpload,
      drivingLicenceUpload,
      cvUpload,
      profilePhotoUpload,
    ] =
      await Promise.all([
        uploadDocument(
          nationalIdFile,
          "nationalIdImage",
          submissionId,
        ),

        uploadDocument(
          drivingLicenceFile,
          "drivingLicenceImage",
          submissionId,
        ),

        uploadDocument(
          cvFile,
          "cv",
          submissionId,
        ),

        profilePhotoFile
          ? uploadDocument(
              profilePhotoFile,
              "profilePhoto",
              submissionId,
            )
          : Promise.resolve(
              null,
            ),
      ]);
  } catch (error) {
    /*
     * The browser may believe an
     * operation failed even though
     * the original submission
     * completed on the server.
     *
     * Check before displaying an
     * error to the applicant.
     */

    try {
      const recovered =
        await findExistingApplication(
          submissionId,
        );

      if (recovered) {
        return completeApplicationSubmission(
          recovered,
          submissionId,
        );
      }
    } catch {
      /*
       * Preserve the original upload
       * error below.
       */
    }

    throw error;
  }

  /* ---------------------------------------
     Save Application
  --------------------------------------- */

  onPhaseChange?.(
    "saving",
  );

  let response:
    Response;

  try {
    response =
      await fetch(
        "/api/applications",
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

              fullName:
                values.fullName,

              email:
                values.email,

              phone:
                values.phone,

              country:
                values.country,

              nationality:
                values.nationality,

              nationalId:
                values.nationalId,

              maritalStatus:
                values.maritalStatus,

              educationLevel:
                values.educationLevel,

              licenceNumber:
                values.licenceNumber,

              licenceCategory:
                values.licenceCategory,

              drivingExperience:
                values.drivingExperience,

              previousEmployer:
                values.previousEmployer ??
                "",

              employmentStatus:
                values.employmentStatus,

              availability:
                values.availability,

              applicantDeclaration:
                values.applicantDeclaration,

              privacyConsent:
                values.privacyConsent,

              documents: {
                nationalIdImage:
                  nationalIdUpload.path,

                drivingLicenceImage:
                  drivingLicenceUpload.path,

                cv:
                  cvUpload.path,

                profilePhoto:
                  profilePhotoUpload?.path ??
                  null,
              },
            }),
        },
      );
  } catch (error) {
    /*
     * The HTTP connection may fail
     * after the server has already
     * committed the application.
     */

    try {
      const recovered =
        await findExistingApplication(
          submissionId,
        );

      if (recovered) {
        return completeApplicationSubmission(
          recovered,
          submissionId,
        );
      }
    } catch {
      /*
       * Preserve original network
       * error.
       */
    }

    throw error;
  }

  /* ---------------------------------------
     Parse Application Response
  --------------------------------------- */

  let result:
    | SuccessfulApplicationResponse
    | FailedApplicationResponse;

  try {
    result =
      (await response.json()) as
        | SuccessfulApplicationResponse
        | FailedApplicationResponse;
  } catch {
    /*
     * If the response was lost or
     * malformed, check whether the
     * database operation actually
     * succeeded.
     */

    const recovered =
      await findExistingApplication(
        submissionId,
      );

    if (recovered) {
      return completeApplicationSubmission(
        recovered,
        submissionId,
      );
    }

    throw new Error(
      "DriveCo received an invalid server response. Please try again.",
    );
  }

  /* ---------------------------------------
     Server Reported Failure
  --------------------------------------- */

  if (
    !response.ok ||
    !result.ok
  ) {
    /*
     * Again check for the narrow case
     * where the database committed but
     * the response received by the
     * browser was unsuccessful.
     */

    const recovered =
      await findExistingApplication(
        submissionId,
      );

    if (recovered) {
      return completeApplicationSubmission(
        recovered,
        submissionId,
      );
    }

    throw new Error(
      !result.ok
        ? result.message ??
            "The application could not be submitted. Please try again."
        : "The application could not be submitted. Please try again.",
    );
  }

  /* ---------------------------------------
     Successful New Application
  --------------------------------------- */

  return completeApplicationSubmission(
    result.application,
    submissionId,
  );
}