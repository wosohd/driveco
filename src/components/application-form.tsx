"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useForm,
  type FieldErrors,
  type Path,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import FileUploadField from "@/components/file-upload-field";

import {
  applicationSchema,
  type ApplicationFormValues,
} from "@/lib/application-schema";

import {
  submitApplication,
  type SubmittedApplication,
  type SubmissionPhase,
} from "@/lib/submit-application";

type SectionKey =
  | "personal"
  | "identification"
  | "driving"
  | "employment"
  | "documents"
  | "declaration";

type OpenSections =
  Record<
    SectionKey,
    boolean
  >;

type FormStatus =
  | "idle"
  | "error";

type SubmissionStatus =
  | "idle"
  | SubmissionPhase
  | "success"
  | "error";

const FIELD_ORDER: Array<
  keyof ApplicationFormValues
> = [
  "fullName",
  "email",
  "phone",
  "country",
  "nationality",

  "nationalId",
  "maritalStatus",
  "educationLevel",

  "licenceNumber",
  "licenceCategory",
  "drivingExperience",

  "employmentStatus",
  "availability",

  "nationalIdImage",
  "drivingLicenceImage",
  "cv",

  "applicantDeclaration",
  "privacyConsent",
];

const FIELD_SECTION: Record<
  keyof ApplicationFormValues,
  SectionKey
> = {
  fullName:
    "personal",

  email:
    "personal",

  phone:
    "personal",

  country:
    "personal",

  nationality:
    "personal",

  nationalId:
    "identification",

  maritalStatus:
    "identification",

  educationLevel:
    "identification",

  licenceNumber:
    "driving",

  licenceCategory:
    "driving",

  drivingExperience:
    "driving",

  previousEmployer:
    "employment",

  employmentStatus:
    "employment",

  availability:
    "employment",

  nationalIdImage:
    "documents",

  drivingLicenceImage:
    "documents",

  cv:
    "documents",

  profilePhoto:
    "documents",

  applicantDeclaration:
    "declaration",

  privacyConsent:
    "declaration",
};

/* ---------------------------------------
   UUID Generator
--------------------------------------- */

/*
 * crypto.randomUUID() is not always
 * available on plain HTTP LAN addresses.
 *
 * localhost and HTTPS usually support it.
 * For LAN development we fall back to a
 * UUID v4 generated with getRandomValues().
 */

function createSubmissionId() {
  const cryptoObject =
    globalThis.crypto;

  if (
    cryptoObject &&
    typeof cryptoObject.randomUUID ===
      "function"
  ) {
    return cryptoObject.randomUUID();
  }

  if (
    !cryptoObject ||
    typeof cryptoObject.getRandomValues !==
      "function"
  ) {
    throw new Error(
      "Secure submission ID generation is not available in this browser.",
    );
  }

  const bytes =
    new Uint8Array(16);

  cryptoObject.getRandomValues(
    bytes,
  );

  /*
   * RFC 4122 UUID v4:
   *
   * version = 4
   * variant = 10xx
   */

  bytes[6] =
    (bytes[6] & 0x0f) |
    0x40;

  bytes[8] =
    (bytes[8] & 0x3f) |
    0x80;

  const hex =
    Array.from(bytes).map(
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
    );

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function ErrorMessage({
  id,
  message,
}: {
  id: string;

  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      className="field-error"
      role="alert"
    >
      {message}
    </p>
  );
}

export default function ApplicationForm() {
  const submissionIdRef =
    useRef<
      string | null
    >(null);

  const [
    openSections,
    setOpenSections,
  ] =
    useState<OpenSections>({
      personal: true,

      identification:
        false,

      driving:
        false,

      employment:
        false,

      documents:
        false,

      declaration:
        false,
    });

  const [
    pendingInvalidField,
    setPendingInvalidField,
  ] =
    useState<
      keyof ApplicationFormValues | null
    >(null);

  const [
    formStatus,
    setFormStatus,
  ] =
    useState<FormStatus>(
      "idle",
    );

  const [
    submissionStatus,
    setSubmissionStatus,
  ] =
    useState<SubmissionStatus>(
      "idle",
    );

  const [
    submissionError,
    setSubmissionError,
  ] =
    useState<
      string | null
    >(null);

  const [
    submittedApplication,
    setSubmittedApplication,
  ] =
    useState<
      SubmittedApplication | null
    >(null);

  const {
    register,
    handleSubmit,
    setFocus,

    formState: {
      errors,
    },
  } =
    useForm<ApplicationFormValues>({
      resolver:
        zodResolver(
          applicationSchema,
        ),

      mode:
        "onBlur",

      reValidateMode:
        "onChange",

      shouldFocusError:
        false,

      shouldUnregister:
        false,

      defaultValues: {
        nationality:
          "Kenyan",

        applicantDeclaration:
          false,

        privacyConsent:
          false,
      },
    });

  const isSubmitting =
    submissionStatus ===
      "uploading" ||
    submissionStatus ===
      "saving";

  function getSubmissionId() {
    if (
      !submissionIdRef.current
    ) {
      submissionIdRef.current =
        createSubmissionId();
    }

    return submissionIdRef.current;
  }

  /* ---------------------------------------
     Accordion Controls
  --------------------------------------- */

  const toggleSection = (
    section:
      SectionKey,
  ) => {
    if (
      isSubmitting
    ) {
      return;
    }

    setOpenSections(
      (current) => ({
        ...current,

        [section]:
          !current[
            section
          ],
      }),
    );
  };

  const expandAll = () => {
    if (
      isSubmitting
    ) {
      return;
    }

    setOpenSections({
      personal: true,
      identification: true,
      driving: true,
      employment: true,
      documents: true,
      declaration: true,
    });
  };

  const collapseAll = () => {
    if (
      isSubmitting
    ) {
      return;
    }

    setOpenSections({
      personal: false,
      identification: false,
      driving: false,
      employment: false,
      documents: false,
      declaration: false,
    });
  };

  /* ---------------------------------------
     Validation Navigation
  --------------------------------------- */

  useEffect(() => {
    if (
      !pendingInvalidField
    ) {
      return;
    }

    const section =
      FIELD_SECTION[
        pendingInvalidField
      ];

    if (
      !openSections[
        section
      ]
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          const sectionElement =
            document.getElementById(
              `${section}-section`,
            );

          const sectionTrigger =
            document.querySelector<HTMLButtonElement>(
              `[aria-controls="${section}-section"]`,
            );

          const scrollTarget =
            sectionTrigger ??
            sectionElement;

          scrollTarget?.scrollIntoView(
            {
              behavior:
                "smooth",

              block:
                "center",
            },
          );

          const fieldElement =
            document.getElementById(
              pendingInvalidField,
            );

          const isHiddenFileInput =
            fieldElement instanceof
              HTMLInputElement &&
            fieldElement.type ===
              "file";

          if (
            isHiddenFileInput
          ) {
            sectionTrigger?.focus(
              {
                preventScroll:
                  true,
              },
            );
          } else {
            try {
              setFocus(
                pendingInvalidField as Path<ApplicationFormValues>,
              );
            } catch {
              fieldElement?.focus();
            }
          }

          setPendingInvalidField(
            null,
          );
        },
        150,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    pendingInvalidField,
    openSections,
    setFocus,
  ]);

  /* ---------------------------------------
     Valid Application
  --------------------------------------- */

  const handleValidForm =
    async (
      values:
        ApplicationFormValues,
    ) => {
      if (
        isSubmitting
      ) {
        return;
      }

      setPendingInvalidField(
        null,
      );

      setFormStatus(
        "idle",
      );

      setSubmissionError(
        null,
      );

      let submissionId:
        string;

      try {
        submissionId =
          getSubmissionId();
      } catch (error) {
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "A submission reference could not be created.",
        );

        setSubmissionStatus(
          "error",
        );

        return;
      }

      try {
        const result =
          await submitApplication(
            values,

            submissionId,

            (phase) => {
              setSubmissionStatus(
                phase,
              );
            },
          );

        setSubmittedApplication(
          result,
        );

        setSubmissionStatus(
          "success",
        );
      } catch (error) {
        setSubmissionError(
          error instanceof Error
            ? error.message
            : "The application could not be submitted. Please try again.",
        );

        setSubmissionStatus(
          "error",
        );
      }
    };

  /* ---------------------------------------
     Invalid Application
  --------------------------------------- */

  const handleInvalidForm = (
    formErrors:
      FieldErrors<ApplicationFormValues>,
  ) => {
    if (
      isSubmitting
    ) {
      return;
    }

    setFormStatus(
      "error",
    );

    setSubmissionError(
      null,
    );

    setSubmissionStatus(
      "idle",
    );

    const firstInvalidField =
      FIELD_ORDER.find(
        (field) =>
          Boolean(
            formErrors[
              field
            ],
          ),
      );

    if (
      !firstInvalidField
    ) {
      return;
    }

    const targetSection =
      FIELD_SECTION[
        firstInvalidField
      ];

    setOpenSections(
      (current) => ({
        ...current,

        [targetSection]:
          true,
      }),
    );

    setPendingInvalidField(
      firstInvalidField,
    );
  };

  /* ---------------------------------------
     Success State
  --------------------------------------- */

  if (
    submissionStatus ===
      "success" &&
    submittedApplication
  ) {
    return (
      <section
        className="submission-success"
        aria-labelledby="submission-success-title"
      >
        <p className="submission-success-eyebrow">
          Application received
        </p>

        <h3
          id="submission-success-title"
          className="submission-success-title"
        >
          Your application has been submitted.
        </h3>

        <p className="submission-success-text">
          Your DriveCo driver
          application was submitted
          free of charge. Keep the
          reference below for your
          records.
        </p>

        <div className="submission-reference">
          <span className="submission-reference-label">
            Application reference
          </span>

          <strong className="submission-reference-value">
            {
              submittedApplication.reference
            }
          </strong>
        </div>

        <p className="submission-success-note">
          Submitting an application
          does not require payment and
          does not guarantee an
          interview or employment.
        </p>
      </section>
    );
  }

  return (
    <form
      className="driver-form"
      noValidate
      aria-busy={
        isSubmitting
      }
      onChange={() => {
        if (
          formStatus !==
          "idle"
        ) {
          setFormStatus(
            "idle",
          );
        }

        if (
          submissionStatus ===
          "error"
        ) {
          setSubmissionStatus(
            "idle",
          );

          setSubmissionError(
            null,
          );
        }
      }}
      onSubmit={handleSubmit(
        handleValidForm,
        handleInvalidForm,
      )}
    >
      {/* ---------------------------------------
          Expand / Collapse
      --------------------------------------- */}

      <div className="accordion-controls">
        <button
          type="button"
          className="accordion-control-button"
          onClick={
            expandAll
          }
          disabled={
            isSubmitting
          }
        >
          <span
            className="control-symbol"
            aria-hidden="true"
          >
            +
          </span>

          <span>
            Expand all sections
          </span>
        </button>

        <button
          type="button"
          className="accordion-control-button"
          onClick={
            collapseAll
          }
          disabled={
            isSubmitting
          }
        >
          <span
            className="control-symbol"
            aria-hidden="true"
          >
            −
          </span>

          <span>
            Collapse all sections
          </span>
        </button>
      </div>

      <div className="accordion">
        {/* =====================================
            01 — Personal Information
        ===================================== */}

        <section className="accordion-section">
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={
              openSections.personal
            }
            aria-controls="personal-section"
            onClick={() =>
              toggleSection(
                "personal",
              )
            }
          >
            <span className="accordion-title-group">
              <span className="accordion-number">
                01
              </span>

              <span className="accordion-heading-copy">
                <span className="accordion-eyebrow">
                  Application form
                </span>

                <span className="accordion-title">
                  Personal information
                </span>
              </span>
            </span>

            <span
              className="accordion-symbol"
              aria-hidden="true"
            >
              {openSections.personal
                ? "−"
                : "+"}
            </span>
          </button>

          <div
            id="personal-section"
            className="accordion-panel"
            hidden={
              !openSections.personal
            }
          >
            <div className="accordion-panel-inner">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="fullName">
                    Full legal name
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full legal name"
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      Boolean(
                        errors.fullName,
                      )
                    }
                    {...register(
                      "fullName",
                    )}
                  />

                  <ErrorMessage
                    id="fullName-error"
                    message={
                      errors.fullName
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="email">
                    Email address
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="example@email.com"
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      Boolean(
                        errors.email,
                      )
                    }
                    {...register(
                      "email",
                    )}
                  />

                  <ErrorMessage
                    id="email-error"
                    message={
                      errors.email
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="phone">
                    Phone / WhatsApp number
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+254 7XX XXX XXX"
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      Boolean(
                        errors.phone,
                      )
                    }
                    {...register(
                      "phone",
                    )}
                  />

                  <ErrorMessage
                    id="phone-error"
                    message={
                      errors.phone
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="country">
                    Country of residence
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="country"
                    type="text"
                    autoComplete="country-name"
                    placeholder="e.g. Kenya"
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      Boolean(
                        errors.country,
                      )
                    }
                    {...register(
                      "country",
                    )}
                  />

                  <p className="field-help">
                    Enter the country where
                    you currently live.
                  </p>

                  <ErrorMessage
                    id="country-error"
                    message={
                      errors.country
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="nationality">
                    Nationality
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="nationality"
                    type="text"
                    value="Kenyan"
                    readOnly
                    aria-readonly="true"
                    {...register(
                      "nationality",
                    )}
                  />

                  <p className="field-help">
                    DriveCo applications are
                    currently open to Kenyan
                    drivers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================
            02 — Identification
        ===================================== */}

        <section className="accordion-section">
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={
              openSections.identification
            }
            aria-controls="identification-section"
            onClick={() =>
              toggleSection(
                "identification",
              )
            }
          >
            <span className="accordion-title-group">
              <span className="accordion-number">
                02
              </span>

              <span className="accordion-heading-copy">
                <span className="accordion-eyebrow">
                  Applicant details
                </span>

                <span className="accordion-title">
                  Identification
                </span>
              </span>
            </span>

            <span
              className="accordion-symbol"
              aria-hidden="true"
            >
              {openSections.identification
                ? "−"
                : "+"}
            </span>
          </button>

          <div
            id="identification-section"
            className="accordion-panel"
            hidden={
              !openSections.identification
            }
          >
            <div className="accordion-panel-inner">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="nationalId">
                    National ID number
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="nationalId"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Enter your national ID number"
                    disabled={
                      isSubmitting
                    }
                    aria-invalid={
                      Boolean(
                        errors.nationalId,
                      )
                    }
                    {...register(
                      "nationalId",
                    )}
                  />

                  <p className="field-help">
                    Enter the number exactly
                    as it appears on your
                    identification document.
                  </p>

                  <ErrorMessage
                    id="nationalId-error"
                    message={
                      errors.nationalId
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="maritalStatus">
                    Marital status
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <select
                    id="maritalStatus"
                    defaultValue=""
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "maritalStatus",
                    )}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select status
                    </option>

                    <option value="single">
                      Single
                    </option>

                    <option value="married">
                      Married
                    </option>

                    <option value="separated">
                      Separated
                    </option>

                    <option value="divorced">
                      Divorced
                    </option>

                    <option value="widowed">
                      Widowed
                    </option>

                    <option value="prefer-not-to-say">
                      Prefer not to say
                    </option>
                  </select>

                  <ErrorMessage
                    id="maritalStatus-error"
                    message={
                      errors.maritalStatus
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="educationLevel">
                    Highest level of education
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <select
                    id="educationLevel"
                    defaultValue=""
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "educationLevel",
                    )}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select education level
                    </option>

                    <option value="primary">
                      Primary education
                    </option>

                    <option value="secondary">
                      Secondary education
                    </option>

                    <option value="certificate">
                      Certificate
                    </option>

                    <option value="diploma">
                      Diploma
                    </option>

                    <option value="degree">
                      Bachelor&apos;s degree
                    </option>

                    <option value="postgraduate">
                      Postgraduate qualification
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>

                  <ErrorMessage
                    id="educationLevel-error"
                    message={
                      errors.educationLevel
                        ?.message
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================
            03 — Driving Information
        ===================================== */}

        <section className="accordion-section">
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={
              openSections.driving
            }
            aria-controls="driving-section"
            onClick={() =>
              toggleSection(
                "driving",
              )
            }
          >
            <span className="accordion-title-group">
              <span className="accordion-number">
                03
              </span>

              <span className="accordion-heading-copy">
                <span className="accordion-eyebrow">
                  Driving credentials
                </span>

                <span className="accordion-title">
                  Driving information
                </span>
              </span>
            </span>

            <span
              className="accordion-symbol"
              aria-hidden="true"
            >
              {openSections.driving
                ? "−"
                : "+"}
            </span>
          </button>

          <div
            id="driving-section"
            className="accordion-panel"
            hidden={
              !openSections.driving
            }
          >
            <div className="accordion-panel-inner">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="licenceNumber">
                    Driving licence number
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <input
                    id="licenceNumber"
                    type="text"
                    autoComplete="off"
                    placeholder="Enter your driving licence number"
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "licenceNumber",
                    )}
                  />

                  <p className="field-help">
                    Enter the licence number
                    exactly as it appears on
                    your current driving
                    licence.
                  </p>

                  <ErrorMessage
                    id="licenceNumber-error"
                    message={
                      errors.licenceNumber
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="licenceCategory">
                    Driving licence category
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <select
                    id="licenceCategory"
                    defaultValue=""
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "licenceCategory",
                    )}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select licence category
                    </option>

                    <option value="A">
                      Category A
                    </option>

                    <option value="B">
                      Category B
                    </option>

                    <option value="C">
                      Category C
                    </option>

                    <option value="D">
                      Category D
                    </option>

                    <option value="E">
                      Category E
                    </option>

                    <option value="other">
                      Other / Multiple categories
                    </option>
                  </select>

                  <ErrorMessage
                    id="licenceCategory-error"
                    message={
                      errors.licenceCategory
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="drivingExperience">
                    Professional driving experience
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <select
                    id="drivingExperience"
                    defaultValue=""
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "drivingExperience",
                    )}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select experience
                    </option>

                    <option value="less-than-1">
                      Less than 1 year
                    </option>

                    <option value="1-2">
                      1–2 years
                    </option>

                    <option value="3-5">
                      3–5 years
                    </option>

                    <option value="6-10">
                      6–10 years
                    </option>

                    <option value="10-plus">
                      More than 10 years
                    </option>
                  </select>

                  <ErrorMessage
                    id="drivingExperience-error"
                    message={
                      errors.drivingExperience
                        ?.message
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================
            04 — Employment & Availability
        ===================================== */}

        <section className="accordion-section">
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={
              openSections.employment
            }
            aria-controls="employment-section"
            onClick={() =>
              toggleSection(
                "employment",
              )
            }
          >
            <span className="accordion-title-group">
              <span className="accordion-number">
                04
              </span>

              <span className="accordion-heading-copy">
                <span className="accordion-eyebrow">
                  Work information
                </span>

                <span className="accordion-title">
                  Employment &amp; availability
                </span>
              </span>
            </span>

            <span
              className="accordion-symbol"
              aria-hidden="true"
            >
              {openSections.employment
                ? "−"
                : "+"}
            </span>
          </button>

          <div
            id="employment-section"
            className="accordion-panel"
            hidden={
              !openSections.employment
            }
          >
            <div className="accordion-panel-inner">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="previousEmployer">
                    Previous or current employer
                  </label>

                  <input
                    id="previousEmployer"
                    type="text"
                    autoComplete="organization"
                    placeholder="Enter employer name"
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "previousEmployer",
                    )}
                  />

                  <p className="field-help">
                    If you have not previously
                    been employed as a driver,
                    you may leave this field
                    blank.
                  </p>

                  <ErrorMessage
                    id="previousEmployer-error"
                    message={
                      errors.previousEmployer
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="employmentStatus">
                    Current employment status
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <select
                    id="employmentStatus"
                    defaultValue=""
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "employmentStatus",
                    )}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select employment status
                    </option>

                    <option value="employed-full-time">
                      Employed full-time
                    </option>

                    <option value="employed-part-time">
                      Employed part-time
                    </option>

                    <option value="self-employed">
                      Self-employed
                    </option>

                    <option value="unemployed">
                      Not currently employed
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>

                  <ErrorMessage
                    id="employmentStatus-error"
                    message={
                      errors.employmentStatus
                        ?.message
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="availability">
                    Availability
                    <span
                      className="required-marker"
                      aria-hidden="true"
                    >
                      *
                    </span>
                  </label>

                  <select
                    id="availability"
                    defaultValue=""
                    disabled={
                      isSubmitting
                    }
                    {...register(
                      "availability",
                    )}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select availability
                    </option>

                    <option value="immediately">
                      Available immediately
                    </option>

                    <option value="within-2-weeks">
                      Within 2 weeks
                    </option>

                    <option value="within-1-month">
                      Within 1 month
                    </option>

                    <option value="more-than-1-month">
                      More than 1 month
                    </option>
                  </select>

                  <ErrorMessage
                    id="availability-error"
                    message={
                      errors.availability
                        ?.message
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================
            05 — Supporting Documents
        ===================================== */}

        <section className="accordion-section">
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={
              openSections.documents
            }
            aria-controls="documents-section"
            onClick={() =>
              toggleSection(
                "documents",
              )
            }
          >
            <span className="accordion-title-group">
              <span className="accordion-number">
                05
              </span>

              <span className="accordion-heading-copy">
                <span className="accordion-eyebrow">
                  Required documents
                </span>

                <span className="accordion-title">
                  Supporting documents
                </span>
              </span>
            </span>

            <span
              className="accordion-symbol"
              aria-hidden="true"
            >
              {openSections.documents
                ? "−"
                : "+"}
            </span>
          </button>

          <div
            id="documents-section"
            className="accordion-panel"
            hidden={
              !openSections.documents
            }
          >
            <div className="accordion-panel-inner">
              <div className="documents-content">
                <div className="documents-intro">
                  <p>
                    Upload clear and readable
                    copies of the requested
                    documents. Only upload
                    documents that belong to
                    you.
                  </p>

                  <p>
                    Images may be JPG, PNG or
                    WebP and must not exceed
                    5 MB. CVs may be PDF, DOC
                    or DOCX and must not
                    exceed 10 MB.
                  </p>
                </div>

                <div className="upload-list">
                  <FileUploadField
                    id="nationalIdImage"
                    label="National ID image"
                    description="Upload one clear image of your National ID."
                    accept="image/jpeg,image/png,image/webp"
                    registration={register(
                      "nationalIdImage",
                    )}
                    error={
                      errors.nationalIdImage
                        ?.message
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                  />

                  <FileUploadField
                    id="drivingLicenceImage"
                    label="Driving licence image"
                    description="Upload one clear image of your current driving licence."
                    accept="image/jpeg,image/png,image/webp"
                    registration={register(
                      "drivingLicenceImage",
                    )}
                    error={
                      errors.drivingLicenceImage
                        ?.message
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                  />

                  <FileUploadField
                    id="cv"
                    label="CV / Résumé"
                    description="Upload your most recent CV or résumé."
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    registration={register(
                      "cv",
                    )}
                    error={
                      errors.cv
                        ?.message
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                  />

                  <FileUploadField
                    id="profilePhoto"
                    label="Profile photo"
                    description="You may optionally provide a recent profile photograph."
                    accept="image/jpeg,image/png,image/webp"
                    registration={register(
                      "profilePhoto",
                    )}
                    error={
                      errors.profilePhoto
                        ?.message
                    }
                    disabled={
                      isSubmitting
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================
            06 — Declaration & Consent
        ===================================== */}

        <section className="accordion-section">
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={
              openSections.declaration
            }
            aria-controls="declaration-section"
            onClick={() =>
              toggleSection(
                "declaration",
              )
            }
          >
            <span className="accordion-title-group">
              <span className="accordion-number">
                06
              </span>

              <span className="accordion-heading-copy">
                <span className="accordion-eyebrow">
                  Final confirmation
                </span>

                <span className="accordion-title">
                  Declaration &amp; consent
                </span>
              </span>
            </span>

            <span
              className="accordion-symbol"
              aria-hidden="true"
            >
              {openSections.declaration
                ? "−"
                : "+"}
            </span>
          </button>

          <div
            id="declaration-section"
            className="accordion-panel"
            hidden={
              !openSections.declaration
            }
          >
            <div className="accordion-panel-inner">
              <div className="consent-content">
                <div className="consent-intro">
                  <p>
                    Before submitting your
                    application, please review
                    and confirm the statements
                    below.
                  </p>
                </div>

                <div className="consent-list">
                  <label
                    className="consent-item"
                    htmlFor="applicantDeclaration"
                  >
                    <input
                      id="applicantDeclaration"
                      type="checkbox"
                      className="consent-checkbox"
                      disabled={
                        isSubmitting
                      }
                      {...register(
                        "applicantDeclaration",
                      )}
                    />

                    <span className="consent-copy">
                      <span className="consent-title">
                        Applicant declaration

                        <span
                          className="required-marker"
                          aria-hidden="true"
                        >
                          *
                        </span>
                      </span>

                      <span className="consent-description">
                        I confirm that the
                        information provided
                        in this application is
                        accurate and that the
                        documents submitted
                        belong to me.
                      </span>

                      {errors.applicantDeclaration
                        ?.message && (
                        <span
                          className="field-error consent-error"
                          role="alert"
                        >
                          {
                            errors.applicantDeclaration
                              .message
                          }
                        </span>
                      )}
                    </span>
                  </label>

                  <label
                    className="consent-item"
                    htmlFor="privacyConsent"
                  >
                    <input
                      id="privacyConsent"
                      type="checkbox"
                      className="consent-checkbox"
                      disabled={
                        isSubmitting
                      }
                      {...register(
                        "privacyConsent",
                      )}
                    />

                    <span className="consent-copy">
                      <span className="consent-title">
                        Data processing consent

                        <span
                          className="required-marker"
                          aria-hidden="true"
                        >
                          *
                        </span>
                      </span>

                      <span className="consent-description">
                        I consent to DriveCo
                        processing the personal
                        information and
                        supporting documents
                        provided with this
                        application for
                        recruitment purposes.
                      </span>

                      {errors.privacyConsent
                        ?.message && (
                        <span
                          className="field-error consent-error"
                          role="alert"
                        >
                          {
                            errors.privacyConsent
                              .message
                          }
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ---------------------------------------
          Application Action
      --------------------------------------- */}

      <div className="application-action">
        <div className="application-action-copy">
          {submissionStatus ===
            "uploading" && (
            <p
              className="form-status is-progress"
              role="status"
            >
              Uploading your supporting
              documents securely...
            </p>
          )}

          {submissionStatus ===
            "saving" && (
            <p
              className="form-status is-progress"
              role="status"
            >
              Documents uploaded. Saving
              your application...
            </p>
          )}

          {submissionStatus ===
            "idle" && (
            <p className="application-action-note">
              Review your information before
              continuing. If anything is
              incomplete, DriveCo will take
              you directly to the section
              that needs attention.
            </p>
          )}

          {formStatus ===
            "error" && (
            <p
              className="form-status is-error"
              role="alert"
            >
              Please correct the highlighted
              field before continuing.
            </p>
          )}

          {submissionStatus ===
            "error" &&
            submissionError && (
              <p
                className="form-status is-error"
                role="alert"
              >
                {
                  submissionError
                }
              </p>
            )}
        </div>

        <button
          type="submit"
          className="save-apply-button"
          disabled={
            isSubmitting
          }
        >
          <span>
            {submissionStatus ===
            "uploading"
              ? "Uploading..."
              : submissionStatus ===
                  "saving"
                ? "Saving..."
                : "Save and Apply"}
          </span>

          <span
            className="apply-arrow"
            aria-hidden="true"
          >
            →
          </span>
        </button>
      </div>
    </form>
  );
}