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
   Turnstile Browser Types
--------------------------------------- */

type TurnstileRenderOptions = {
  sitekey: string;

  action?: string;

  theme?:
    | "auto"
    | "light"
    | "dark";

  execution?:
    | "render"
    | "execute";

  appearance?:
    | "always"
    | "execute"
    | "interaction-only";

  callback: (
    token: string,
  ) => void;

  "error-callback"?: (
    errorCode?: string,
  ) => void;

  "expired-callback"?: () => void;

  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  render: (
    container:
      HTMLElement,

    options:
      TurnstileRenderOptions,
  ) => string;

  execute: (
    widgetId:
      string,
  ) => void;

  remove: (
    widgetId:
      string,
  ) => void;
};

declare global {
  interface Window {
    turnstile?:
      TurnstileApi;

    __drivecoTurnstileScriptPromise?:
      Promise<void>;
  }
}

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const TURNSTILE_ACTION =
  "driver_application";

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
   Turnstile Script Loader
--------------------------------------- */

function loadTurnstileScript():
  Promise<void> {
  if (
    typeof window ===
    "undefined"
  ) {
    return Promise.reject(
      new Error(
        "Security verification is not available.",
      ),
    );
  }

  if (
    window.turnstile
  ) {
    return Promise.resolve();
  }

  if (
    window
      .__drivecoTurnstileScriptPromise
  ) {
    return window
      .__drivecoTurnstileScriptPromise;
  }

  window.__drivecoTurnstileScriptPromise =
    new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        const existingScript =
          document.querySelector<HTMLScriptElement>(
            'script[data-driveco-turnstile="true"]',
          );

        const finishLoad =
          () => {
            if (
              window.turnstile
            ) {
              resolve();

              return;
            }

            reject(
              new Error(
                "Security verification could not be loaded.",
              ),
            );
          };

        if (
          existingScript
        ) {
          existingScript.addEventListener(
            "load",
            finishLoad,
            {
              once: true,
            },
          );

          existingScript.addEventListener(
            "error",
            () => {
              reject(
                new Error(
                  "Security verification could not be loaded.",
                ),
              );
            },
            {
              once: true,
            },
          );

          return;
        }

        const script =
          document.createElement(
            "script",
          );

        script.src =
          TURNSTILE_SCRIPT_URL;

        script.async =
          true;

        script.defer =
          true;

        script.dataset.drivecoTurnstile =
          "true";

        script.addEventListener(
          "load",
          finishLoad,
          {
            once: true,
          },
        );

        script.addEventListener(
          "error",
          () => {
            reject(
              new Error(
                "Security verification could not be loaded.",
              ),
            );
          },
          {
            once: true,
          },
        );

        document.head.appendChild(
          script,
        );
      },
    );

  return window
    .__drivecoTurnstileScriptPromise;
}

/* ---------------------------------------
   Generate Fresh Turnstile Token
--------------------------------------- */

async function getTurnstileToken():
  Promise<string> {
  const siteKey =
    process.env
      .NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    throw new Error(
      "Security verification is not configured.",
    );
  }

  await loadTurnstileScript();

  const turnstile =
    window.turnstile;

  if (!turnstile) {
    throw new Error(
      "Security verification could not be initialized.",
    );
  }

  const container =
    document.createElement(
      "div",
    );

  /*
   * The widget remains invisible for
   * most legitimate users.
   *
   * If Cloudflare requires interaction,
   * the challenge can appear in the
   * lower-right corner.
   */

  container.style.position =
    "fixed";

  container.style.right =
    "16px";

  container.style.bottom =
    "16px";

  container.style.zIndex =
    "2147483647";

  container.style.maxWidth =
    "calc(100vw - 32px)";

  document.body.appendChild(
    container,
  );

  return new Promise<string>(
    (
      resolve,
      reject,
    ) => {
      let widgetId:
        string | null =
          null;

      let settled =
        false;

      const timeout =
        window.setTimeout(
          () => {
            fail(
              "Security verification timed out. Please try again.",
            );
          },
          120_000,
        );

      function cleanup() {
        window.clearTimeout(
          timeout,
        );

        if (
          widgetId &&
          window.turnstile
        ) {
          try {
            window.turnstile.remove(
              widgetId,
            );
          } catch {
            /*
             * Cleanup failure should
             * never affect submission.
             */
          }
        }

        container.remove();
      }

      function succeed(
        token: string,
      ) {
        if (settled) {
          return;
        }

        settled =
          true;

        cleanup();

        resolve(token);
      }

      function fail(
        message: string,
      ) {
        if (settled) {
          return;
        }

        settled =
          true;

        cleanup();

        reject(
          new Error(
            message,
          ),
        );
      }

      try {
        widgetId =
          turnstile.render(
            container,
            {
              sitekey:
                siteKey,

              action:
                TURNSTILE_ACTION,

              theme:
                "auto",

              execution:
                "execute",

              appearance:
                "interaction-only",

              callback: (
                token,
              ) => {
                if (!token) {
                  fail(
                    "Security verification failed. Please try again.",
                  );

                  return;
                }

                succeed(
                  token,
                );
              },

              "error-callback":
                () => {
                  fail(
                    "Security verification failed. Please try again.",
                  );
                },

              "expired-callback":
                () => {
                  fail(
                    "Security verification expired. Please try again.",
                  );
                },

              "timeout-callback":
                () => {
                  fail(
                    "Security verification timed out. Please try again.",
                  );
                },
            },
          );

        turnstile.execute(
          widgetId,
        );
      } catch {
        fail(
          "Security verification could not be started.",
        );
      }
    },
  );
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
       * Preserve the original
       * upload error.
       */
    }

    throw error;
  }

  /* ---------------------------------------
     Human Verification
  --------------------------------------- */

  const turnstileToken =
    await getTurnstileToken();

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

            "X-Turnstile-Token":
              turnstileToken,
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