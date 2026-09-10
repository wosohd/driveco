"use client";

import {
  useState,
} from "react";

import styles from "@/app/placement/[submissionId]/placement.module.css";

type PaymentMode =
  | "disabled"
  | "mock"
  | "live";

type PaymentProvider =
  | "mpesa"
  | "stripe";

type MockOutcome =
  | "succeeded"
  | "failed"
  | "cancelled";

type PaymentAttempt = {
  id: string;

  provider:
    PaymentProvider;

  status: string;

  reference:
    string | null;
};

type PaymentPanelProps = {
  submissionId:
    string;

  paymentMode:
    PaymentMode;

  initialPlacementStatus:
    string | null;
};

export default function PaymentPanel({
  submissionId,
  paymentMode,
  initialPlacementStatus,
}: PaymentPanelProps) {
  const [
    consent,
    setConsent,
  ] =
    useState(false);

  const [
    provider,
    setProvider,
  ] =
    useState<
      PaymentProvider | null
    >(null);

  const [
    payment,
    setPayment,
  ] =
    useState<
      PaymentAttempt | null
    >(null);

  const [
    finalOutcome,
    setFinalOutcome,
  ] =
    useState<
      MockOutcome | null
    >(null);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const alreadyComplete =
    initialPlacementStatus !==
      null &&
    [
      "paid",
      "distribution_pending",
      "distributed",
    ].includes(
      initialPlacementStatus,
    );

  const canInteract =
    paymentMode ===
    "mock";

  if (
    alreadyComplete ||
    finalOutcome ===
      "succeeded"
  ) {
    return (
      <div
        className={
          styles.paymentSuccess
        }
      >
        <p
          className={
            styles.paymentSuccessEyebrow
          }
        >
          Payment confirmed
        </p>

        <h3>
          Your application is queued
          for distribution.
        </h3>

        <p>
          DriveCo has recorded the
          application distribution
          service payment. Your driver
          profile can now proceed to
          the distribution stage.
        </p>

        {payment?.reference && (
          <div
            className={
              styles.paymentReference
            }
          >
            Payment reference

            <strong>
              {
                payment.reference
              }
            </strong>
          </div>
        )}
      </div>
    );
  }

  async function initiatePayment() {
    if (
      !consent ||
      !provider ||
      !canInteract
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setFinalOutcome(null);

    try {
      const response =
        await fetch(
          "/api/payments/initiate",
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

                provider,

                serviceConsent:
                  consent,
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "The payment could not be started.",
        );
      }

      if (
        result.alreadyCompleted
      ) {
        setFinalOutcome(
          "succeeded",
        );

        return;
      }

      setPayment({
        id:
          result.payment.id,

        provider:
          result.payment.provider,

        status:
          result.payment.status,

        reference:
          result.payment.reference ??
          null,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The payment could not be started.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeMockPayment(
    outcome:
      MockOutcome,
  ) {
    if (
      !payment
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/payments/mock/complete",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                paymentId:
                  payment.id,

                outcome,
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "The mock payment could not be completed.",
        );
      }

      setPayment(
        (current) =>
          current
            ? {
                ...current,

                status:
                  result.payment.status,

                reference:
                  result.payment.reference ??
                  current.reference,
              }
            : current,
      );

      setFinalOutcome(
        outcome,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The mock payment could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetAttempt() {
    setPayment(null);
    setFinalOutcome(null);
    setError(null);
  }

  return (
    <>
      <label
        className={
          styles.consent
        }
      >
        <input
          type="checkbox"
          checked={
            consent
          }
          disabled={
            !canInteract ||
            busy ||
            Boolean(payment)
          }
          onChange={(
            event,
          ) =>
            setConsent(
              event.target
                .checked,
            )
          }
        />

        <span>
          I understand that this
          optional service costs
          KSh 200 and that payment
          does not guarantee an
          interview, job offer or
          employment.
        </span>
      </label>

      <div
        className={
          styles.providers
        }
      >
        <button
          type="button"
          aria-pressed={
            provider ===
            "mpesa"
          }
          disabled={
            !canInteract ||
            busy ||
            Boolean(payment)
          }
          className={`${styles.providerButton} ${
            provider ===
            "mpesa"
              ? styles.providerSelected
              : ""
          }`}
          onClick={() =>
            setProvider(
              "mpesa",
            )
          }
        >
          <span>
            M-Pesa
          </span>

          <small>
            Mobile payment prompt
          </small>
        </button>

        <button
          type="button"
          aria-pressed={
            provider ===
            "stripe"
          }
          disabled={
            !canInteract ||
            busy ||
            Boolean(payment)
          }
          className={`${styles.providerButton} ${
            provider ===
            "stripe"
              ? styles.providerSelected
              : ""
          }`}
          onClick={() =>
            setProvider(
              "stripe",
            )
          }
        >
          <span>
            Stripe
          </span>

          <small>
            Secure online checkout
          </small>
        </button>
      </div>

      {paymentMode ===
        "disabled" && (
        <div
          className={
            styles.disabledMessage
          }
          role="status"
        >
          Payment processing is
          currently disabled while
          DriveCo completes testing
          and commercial activation.
          No payment can be collected
          from this page.
        </div>
      )}

      {paymentMode ===
        "live" && (
        <div
          className={
            styles.disabledMessage
          }
        >
          Live payment providers have
          not yet been activated.
        </div>
      )}

      {paymentMode ===
        "mock" &&
        !payment && (
          <div
            className={
              styles.mockMessage
            }
          >
            <strong>
              Mock payment mode
            </strong>

            <p>
              No real money will move.
              Choose a provider and
              continue to create a
              simulated payment
              attempt.
            </p>
          </div>
        )}

      {error && (
        <p
          className={
            styles.paymentError
          }
          role="alert"
        >
          {error}
        </p>
      )}

      {payment &&
        !finalOutcome && (
          <div
            className={
              styles.mockConsole
            }
          >
            <p
              className={
                styles.mockEyebrow
              }
            >
              Mock provider response
            </p>

            <h3>
              Simulate the payment
              result
            </h3>

            <p>
              Provider:{" "}
              <strong>
                {payment.provider ===
                "mpesa"
                  ? "M-Pesa"
                  : "Stripe"}
              </strong>
            </p>

            {payment.reference && (
              <p>
                Reference:{" "}
                <strong>
                  {
                    payment.reference
                  }
                </strong>
              </p>
            )}

            <div
              className={
                styles.mockActions
              }
            >
              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  completeMockPayment(
                    "succeeded",
                  )
                }
              >
                Simulate success
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  completeMockPayment(
                    "failed",
                  )
                }
              >
                Simulate failure
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  completeMockPayment(
                    "cancelled",
                  )
                }
              >
                Simulate cancellation
              </button>
            </div>
          </div>
        )}

      {finalOutcome ===
        "failed" && (
        <div
          className={
            styles.paymentResult
          }
        >
          <strong>
            Payment failed.
          </strong>

          <p>
            No placement payment was
            recorded. You may create
            another payment attempt.
          </p>

          <button
            type="button"
            onClick={
              resetAttempt
            }
          >
            Try again
          </button>
        </div>
      )}

      {finalOutcome ===
        "cancelled" && (
        <div
          className={
            styles.paymentResult
          }
        >
          <strong>
            Payment cancelled.
          </strong>

          <p>
            No payment was completed.
            You may restart the
            payment process whenever
            you are ready.
          </p>

          <button
            type="button"
            onClick={
              resetAttempt
            }
          >
            Start another attempt
          </button>
        </div>
      )}

      {!payment &&
        !finalOutcome && (
          <div
            className={
              styles.actions
            }
          >
            <a
              href="/"
              className={
                styles.secondaryAction
              }
            >
              Return to DriveCo
            </a>

            <button
              type="button"
              disabled={
                !canInteract ||
                !consent ||
                !provider ||
                busy
              }
              className={
                styles.primaryAction
              }
              onClick={
                initiatePayment
              }
            >
              {busy
                ? "Preparing..."
                : "Proceed to payment"}
            </button>
          </div>
        )}
    </>
  );
}