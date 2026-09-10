import { z } from "zod";

export const DOCUMENT_BUCKET =
  "driveco-applications";

export const documentTypeSchema = z.enum([
  "nationalIdImage",
  "drivingLicenceImage",
  "cv",
  "profilePhoto",
]);

export type DocumentType =
  z.infer<typeof documentTypeSchema>;

const FIVE_MB =
  5 * 1024 * 1024;

const TEN_MB =
  10 * 1024 * 1024;

type DocumentRule = {
  maxSize: number;

  allowedExtensions:
    readonly string[];

  allowedMimeTypes:
    readonly string[];
};

export const DOCUMENT_RULES: Record<
  DocumentType,
  DocumentRule
> = {
  nationalIdImage: {
    maxSize: FIVE_MB,

    allowedExtensions: [
      "jpg",
      "jpeg",
      "png",
      "webp",
    ],

    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },

  drivingLicenceImage: {
    maxSize: FIVE_MB,

    allowedExtensions: [
      "jpg",
      "jpeg",
      "png",
      "webp",
    ],

    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },

  cv: {
    maxSize: TEN_MB,

    allowedExtensions: [
      "pdf",
      "doc",
      "docx",
    ],

    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },

  profilePhoto: {
    maxSize: FIVE_MB,

    allowedExtensions: [
      "jpg",
      "jpeg",
      "png",
      "webp",
    ],

    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },
};

const MIME_BY_EXTENSION: Record<
  string,
  string
> = {
  jpg: "image/jpeg",

  jpeg: "image/jpeg",

  png: "image/png",

  webp: "image/webp",

  pdf: "application/pdf",

  doc: "application/msword",

  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function getFileExtension(
  fileName: string,
) {
  const dotIndex =
    fileName.lastIndexOf(".");

  if (
    dotIndex === -1 ||
    dotIndex ===
      fileName.length - 1
  ) {
    return null;
  }

  return fileName
    .slice(dotIndex + 1)
    .toLowerCase();
}

export function getCanonicalMimeType(
  fileName: string,
) {
  const extension =
    getFileExtension(
      fileName,
    );

  if (!extension) {
    return null;
  }

  return (
    MIME_BY_EXTENSION[
      extension
    ] ?? null
  );
}

export const uploadSigningSchema =
  z
    .object({
      submissionId: z
        .string()
        .uuid(
          "Submission ID is invalid.",
        ),

      documentType:
        documentTypeSchema,

      fileName: z
        .string()
        .trim()
        .min(
          1,
          "File name is required.",
        )
        .max(
          255,
          "File name is too long.",
        )
        .refine(
          (value) =>
            !/[\\/]/.test(
              value,
            ),
          {
            message:
              "Invalid file name.",
          },
        ),

      fileType: z
        .string()
        .trim()
        .max(150)
        .default(""),

      fileSize: z
        .number()
        .int()
        .positive(
          "File must not be empty.",
        )
        .max(
          TEN_MB,
          "File must not exceed 10 MB.",
        ),
    })
    .superRefine(
      (
        value,
        context,
      ) => {
        const rule =
          DOCUMENT_RULES[
            value.documentType
          ];

        const extension =
          getFileExtension(
            value.fileName,
          );

        if (
          !extension ||
          !rule.allowedExtensions.includes(
            extension,
          )
        ) {
          context.addIssue({
            code: "custom",

            path: [
              "fileName",
            ],

            message:
              value.documentType ===
              "cv"
                ? "CV must be a PDF, DOC or DOCX file."
                : "Image must be a JPG, PNG or WebP file.",
          });
        }

        if (
          value.fileSize >
          rule.maxSize
        ) {
          context.addIssue({
            code: "custom",

            path: [
              "fileSize",
            ],

            message:
              rule.maxSize ===
              FIVE_MB
                ? "Image must be 5 MB or smaller."
                : "CV must be 10 MB or smaller.",
          });
        }

        if (
          value.fileType &&
          !rule.allowedMimeTypes.includes(
            value.fileType,
          )
        ) {
          context.addIssue({
            code: "custom",

            path: [
              "fileType",
            ],

            message:
              "The selected file type is not allowed.",
          });
        }

        if (
          extension &&
          value.fileType
        ) {
          const canonicalMime =
            MIME_BY_EXTENSION[
              extension
            ];

          if (
            canonicalMime &&
            canonicalMime !==
              value.fileType
          ) {
            context.addIssue({
              code:
                "custom",

              path: [
                "fileType",
              ],

              message:
                "The file extension and file type do not match.",
            });
          }
        }
      },
    );

export type UploadSigningRequest =
  z.infer<
    typeof uploadSigningSchema
  >;