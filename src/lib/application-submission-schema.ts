import {
  z,
} from "zod";

const privateStoragePath = z
  .string()
  .trim()
  .min(
    1,
    "Document path is required.",
  )
  .max(
    500,
    "Document path is invalid.",
  );

export const applicationSubmissionSchema =
  z.object({
    submissionId: z
      .string()
      .uuid(
        "Submission ID is invalid.",
      ),

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

    nationality:
      z.literal(
        "Kenyan",
        {
          message:
            "Applications are currently limited to Kenyan drivers.",
        },
      ),

    nationalId: z
      .string()
      .trim()
      .regex(
        /^\d{6,12}$/,
        "Please enter a valid National ID number.",
      ),

    maritalStatus: z.enum([
      "single",
      "married",
      "separated",
      "divorced",
      "widowed",
      "prefer-not-to-say",
    ]),

    educationLevel: z.enum([
      "primary",
      "secondary",
      "certificate",
      "diploma",
      "degree",
      "postgraduate",
      "other",
    ]),

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

    licenceCategory: z.enum([
      "A",
      "B",
      "C",
      "D",
      "E",
      "other",
    ]),

    drivingExperience: z.enum([
      "less-than-1",
      "1-2",
      "3-5",
      "6-10",
      "10-plus",
    ]),

    previousEmployer: z
      .string()
      .trim()
      .max(
        120,
        "Employer name is too long.",
      )
      .optional()
      .default(""),

    employmentStatus: z.enum([
      "employed-full-time",
      "employed-part-time",
      "self-employed",
      "unemployed",
      "other",
    ]),

    availability: z.enum([
      "immediately",
      "within-2-weeks",
      "within-1-month",
      "more-than-1-month",
    ]),

    applicantDeclaration: z
      .boolean()
      .refine(
        (value) =>
          value,
        {
          message:
            "Applicant declaration must be accepted.",
        },
      ),

    privacyConsent: z
      .boolean()
      .refine(
        (value) =>
          value,
        {
          message:
            "Data processing consent must be accepted.",
        },
      ),

    documents:
      z.object({
        nationalIdImage:
          privateStoragePath,

        drivingLicenceImage:
          privateStoragePath,

        cv:
          privateStoragePath,

        profilePhoto:
          privateStoragePath
            .nullable()
            .optional(),
      }),
  });

export type ApplicationSubmission =
  z.infer<
    typeof applicationSubmissionSchema
  >;