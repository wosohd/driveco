"use client";

import {
  useState,
  type ChangeEvent,
} from "react";

import type {
  UseFormRegisterReturn,
} from "react-hook-form";

type FileUploadFieldProps = {
  id: string;

  label: string;

  description: string;

  accept: string;

  registration:
    UseFormRegisterReturn;

  error?: string;

  required?: boolean;

  disabled?: boolean;
};

export default function FileUploadField({
  id,
  label,
  description,
  accept,
  registration,
  error,
  required = false,
  disabled = false,
}: FileUploadFieldProps) {
  const [
    fileName,
    setFileName,
  ] =
    useState("");

  const handleFileChange = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target.files?.[0];

    setFileName(
      selectedFile?.name ??
        "",
    );

    registration.onChange(
      event,
    );
  };

  const descriptionId =
    `${id}-help`;

  const errorId =
    `${id}-error`;

  const describedBy =
    error
      ? `${descriptionId} ${errorId}`
      : descriptionId;

  return (
    <div
      className={`upload-field ${
        error
          ? "has-error"
          : ""
      }`}
    >
      <div className="upload-copy">
        <label
          htmlFor={id}
          className="upload-label"
        >
          {label}

          {required && (
            <span
              className="required-marker"
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>

        <p
          id={descriptionId}
          className="upload-description"
        >
          {description}
        </p>

        {error && (
          <p
            id={errorId}
            className="field-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <div className="upload-control">
        <input
          {...registration}
          id={id}
          type="file"
          accept={accept}
          required={
            required
          }
          disabled={
            disabled
          }
          className="upload-input"
          aria-invalid={
            Boolean(error)
          }
          aria-describedby={
            describedBy
          }
          onChange={
            handleFileChange
          }
        />

        <label
          htmlFor={id}
          className="upload-button"
          aria-disabled={
            disabled
          }
        >
          Choose file
        </label>

        <span
          className={`upload-filename ${
            fileName
              ? "has-selected-file"
              : ""
          }`}
        >
          {fileName ||
            "No file selected"}
        </span>
      </div>
    </div>
  );
}