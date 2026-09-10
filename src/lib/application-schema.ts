import { z } from "zod";

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const MAX_CV_SIZE =
  10 * 1024 * 1024;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function getFirstFile(
  value: unknown,
): File | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("length" in value)
  ) {
    return undefined;
  }

  const files =
    value as FileList;

  if (files.length === 0) {
    return undefined;
  }

  return (
    files.item(0) ??
    undefined
  );
}

/* ---------------------------------------
   Required Image
--------------------------------------- */

const requiredImageFile = z
  .custom<FileList>(
    (value) =>
      Boolean(
        getFirstFile(value),
      ),
    {
      message:
        "Please choose an image.",
    },
  )
  .refine(
    (files) => {
      const file =
        getFirstFile(files);

      return (
        !file ||
        IMAGE_TYPES.includes(
          file.type,
        )
      );
    },
    {
      message:
        "Please use a JPG, PNG or WebP image.",
    },
  )
  .refine(
    (files) => {
      const file =
        getFirstFile(files);

      return (
        !file ||
        file.size <=
          MAX_IMAGE_SIZE
      );
    },
    {
      message:
        "The image must be 5 MB or smaller.",
    },
  );

/* ---------------------------------------
   Required CV
--------------------------------------- */

const requiredCvFile = z
  .custom<FileList>(
    (value) =>
      Boolean(
        getFirstFile(value),
      ),
    {
      message:
        "Please upload your CV or résumé.",
    },
  )
  .refine(
    (files) => {
      const file =
        getFirstFile(files);

      if (!file) {
        return true;
      }

      const validMimeType =
        CV_TYPES.includes(
          file.type,
        );

      const validExtension =
        /\.(pdf|doc|docx)$/i.test(
          file.name,
        );

      return (
        validMimeType ||
        validExtension
      );
    },
    {
      message:
        "Please upload a PDF, DOC or DOCX file.",
    },
  )
  .refine(
    (files) => {
      const file =
        getFirstFile(files);

      return (
        !file ||
        file.size <=
          MAX_CV_SIZE
      );
    },
    {
      message:
        "The CV must be 10 MB or smaller.",
    },
  );

/* ---------------------------------------
   Optional Profile Photo
--------------------------------------- */

const optionalProfilePhoto = z
  .custom<
    FileList | undefined
  >()
  .refine(
    (files) => {
      const file =
        getFirstFile(files);

      return (
        !file ||
        IMAGE_TYPES.includes(
          file.type,
        )
      );
    },
    {
      message:
        "Please use a JPG, PNG or WebP image.",
    },
  )
  .refine(
    (files) => {
      const file =
        getFirstFile(files);

      return (
        !file ||
        file.size <=
          MAX_IMAGE_SIZE
      );
    },
    {
      message:
        "The profile photo must be 5 MB or smaller.",
    },
  );

/* ---------------------------------------
   Application Schema
--------------------------------------- */

export const applicationSchema =
  z.object({
    /* ---------------------------------------
       Personal Information
    --------------------------------------- */

    fullName: z
      .string()
      .trim()
      .min(
        2,
        "Please enter your full legal name.",
      )
      .max(
        100,
        "Your name is too long.",
      ),

    email: z
      .string()
      .trim()
      .min(
        1,
        "Please enter your email address.",
      )
      .email(
        "Please enter a valid email address.",
      ),

    phone: z
      .string()
      .trim()
      .min(
        1,
        "Please enter your phone or WhatsApp number.",
      )
      .refine(
        (value) =>
          /^\+?[0-9()\-\s]{7,20}$/.test(
            value,
          ),
        {
          message:
            "Please enter a valid phone number.",
        },
      ),

    country: z
      .string()
      .trim()
      .min(
        2,
        "Please enter your country of residence.",
      )
      .max(
        60,
        "Country name is too long.",
      ),

    /*
     * This is deliberately a literal rather
     * than string().refine().
     *
     * It keeps Zod's input/output types
     * identical for React Hook Form while
     * still enforcing Kenyan nationality.
     */

    nationality:
      z.literal(
        "Kenyan",
        {
          message:
            "Applications are currently limited to Kenyan drivers.",
        },
      ),

    /* ---------------------------------------
       Identification
    --------------------------------------- */

    nationalId: z
      .string()
      .trim()
      .min(
        1,
        "Please enter your National ID number.",
      )
      .regex(
        /^\d{6,12}$/,
        "Please enter a valid National ID number.",
      ),

    maritalStatus: z
      .string()
      .min(
        1,
        "Please select your marital status.",
      ),

    educationLevel: z
      .string()
      .min(
        1,
        "Please select your education level.",
      ),

    /* ---------------------------------------
       Driving Information
    --------------------------------------- */

    licenceNumber: z
      .string()
      .trim()
      .min(
        3,
        "Please enter your driving licence number.",
      )
      .max(
        30,
        "Driving licence number is too long.",
      )
      .regex(
        /^[A-Za-z0-9\s\-/]+$/,
        "Please enter a valid driving licence number.",
      ),

    licenceCategory: z
      .string()
      .min(
        1,
        "Please select your driving licence category.",
      ),

    drivingExperience: z
      .string()
      .min(
        1,
        "Please select your driving experience.",
      ),

    /* ---------------------------------------
       Employment & Availability
    --------------------------------------- */

    previousEmployer: z
      .string()
      .trim()
      .max(
        120,
        "Employer name is too long.",
      )
      .optional(),

    employmentStatus: z
      .string()
      .min(
        1,
        "Please select your employment status.",
      ),

    availability: z
      .string()
      .min(
        1,
        "Please select your availability.",
      ),

    /* ---------------------------------------
       Documents
    --------------------------------------- */

    nationalIdImage:
      requiredImageFile,

    drivingLicenceImage:
      requiredImageFile,

    cv:
      requiredCvFile,

    profilePhoto:
      optionalProfilePhoto,

    /* ---------------------------------------
       Declaration & Consent
    --------------------------------------- */

    applicantDeclaration: z
      .boolean()
      .refine(
        (value) =>
          value,
        {
          message:
            "You must confirm that the information provided is accurate.",
        },
      ),

    privacyConsent: z
      .boolean()
      .refine(
        (value) =>
          value,
        {
          message:
            "You must consent to the processing of your application information.",
        },
      ),
  });

export type ApplicationFormValues =
  z.infer<
    typeof applicationSchema
  >;