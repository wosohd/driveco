"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "@/app/placement/[submissionId]/placement.module.css";

import type {
  PaymentMode,
  PaymentProvider,
} from "@/lib/payments/types";

type PaymentOutcome =
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

type PaymentStatusResult =
  | {
      ok: true;

      applicationReference:
        string;

      placement: {
        exists:
          boolean;

        status:
          string | null;

        completed?:
          boolean;
      };

      payment:
        | {
            id:
              string;

            provider:
              PaymentProvider;

            status:
              string;

            reference:
              string | null;

            initiatedAt:
              string | null;

            confirmedAt:
              string | null;

            failedAt:
              string | null;
          }
        | null;
    }
  | {
      ok: false;

      message?:
        string;
    };

type PaymentPanelProps = {
  submissionId:
    string;

  paymentMode:
    PaymentMode;

  initialPlacementStatus:
    string | null;
};

const POLL_INTERVAL_MS =
  5_000;

const MAX_POLL_ATTEMPTS =
  24;

function providerName(
  provider:
    PaymentProvider,
) {
  return provider ===
    "mpesa"
    ? "M-Pesa"
    : "Stripe";
}

function clearPaymentQuery() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const url =
    new URL(
      window.location.href,
    );

  if (
    !url.searchParams.has(
      "payment",
    )
  ) {
    return;
  }

  url.searchParams.delete(
    "payment",
  );

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

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
    phoneNumber,
    setPhoneNumber,
  ] =
    useState("");

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
      PaymentOutcome | null
    >(null);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    polling,
    setPolling,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    providerMessage,
    setProviderMessage,
  ] =
    useState<
      string | null
    >(null);

  /*
   * A Stripe cancel URL means the
   * browser left Checkout.
   *
   * It does NOT mean Stripe has
   * authoritatively cancelled the
   * server-side session.
   */
  const [
    browserStripeCancelled,
    setBrowserStripeCancelled,
  ] =
    useState(false);

  const pollAttemptsRef =
    useRef(0);

  const isMockMode =
    paymentMode ===
    "mock";

  const isExternalMode =
    paymentMode ===
      "sandbox" ||
    paymentMode ===
      "live";

  const canInteract =
    isMockMode ||
    isExternalMode;

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

  const checkPaymentStatus =
    useCallback(
      async () => {
        const response =
          await fetch(
            "/api/payments/status",
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
          PaymentStatusResult;

        try {
          result =
            (await response.json()) as
              PaymentStatusResult;
        } catch {
          throw new Error(
            "Payment status could not be checked.",
          );
        }

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            !result.ok
              ? result.message ??
                  "Payment status could not be checked."
              : "Payment status could not be checked.",
          );
        }

        if (
          result.payment
        ) {
          setPayment({
            id:
              result.payment.id,

            provider:
              result.payment.provider,

            status:
              result.payment.status,

            reference:
              result.payment.reference,
          });

          setProvider(
            result.payment.provider,
          );
        }

        if (
          result.placement
            .completed ||
          result.payment
            ?.status ===
            "succeeded"
        ) {
          setFinalOutcome(
            "succeeded",
          );

          setPolling(
            false,
          );

          setProviderMessage(
            null,
          );

          setBrowserStripeCancelled(
            false,
          );

          clearPaymentQuery();

          return "succeeded" as const;
        }

        if (
          result.payment
            ?.status ===
            "failed"
        ) {
          setFinalOutcome(
            "failed",
          );

          setPolling(
            false,
          );

          setProviderMessage(
            null,
          );

          clearPaymentQuery();

          return "failed" as const;
        }

        if (
          result.payment
            ?.status ===
            "cancelled"
        ) {
          setFinalOutcome(
            "cancelled",
          );

          setPolling(
            false,
          );

          setProviderMessage(
            null,
          );

          setBrowserStripeCancelled(
            false,
          );

          clearPaymentQuery();

          return "cancelled" as const;
        }

        if (
          result.payment &&
          [
            "created",
            "pending",
          ].includes(
            result.payment
              .status,
          )
        ) {
          setFinalOutcome(
            null,
          );

          if (
            result.payment
              .provider ===
            "mpesa"
          ) {
            setProviderMessage(
              "Waiting for M-Pesa confirmation.",
            );
          } else {
            setProviderMessage(
              "Waiting for Stripe payment confirmation.",
            );
          }

          return "pending" as const;
        }

        return "none" as const;
      },
      [
        submissionId,
      ],
    );

  function beginPolling() {
    pollAttemptsRef.current =
      0;

    setPolling(
      true,
    );
  }

  /* ---------------------------------------
     Poll Authoritative Server State
  --------------------------------------- */

  useEffect(() => {
    if (
      !isExternalMode ||
      !polling ||
      alreadyComplete
    ) {
      return;
    }

    let stopped =
      false;

    let timer:
      ReturnType<
        typeof window.setTimeout
      > | null =
        null;

    async function tick() {
      if (stopped) {
        return;
      }

      pollAttemptsRef.current +=
        1;

      try {
        const state =
          await checkPaymentStatus();

        if (
          stopped ||
          state ===
            "succeeded" ||
          state ===
            "failed" ||
          state ===
            "cancelled"
        ) {
          return;
        }
      } catch {
        /*
         * A temporary status error
         * should not immediately
         * destroy a provider payment
         * attempt.
         */
      }

      if (
        pollAttemptsRef.current >=
        MAX_POLL_ATTEMPTS
      ) {
        setPolling(
          false,
        );

        setProviderMessage(
          "Payment is still awaiting confirmation. You can check the status again.",
        );

        return;
      }

      timer =
        window.setTimeout(
          tick,
          POLL_INTERVAL_MS,
        );
    }

    void tick();

    return () => {
      stopped =
        true;

      if (timer) {
        window.clearTimeout(
          timer,
        );
      }
    };
  }, [
    alreadyComplete,
    checkPaymentStatus,
    isExternalMode,
    polling,
  ]);

  /* ---------------------------------------
     Recover State After Refresh / Stripe
     Redirect
  --------------------------------------- */

  useEffect(() => {
    if (
      !isExternalMode ||
      alreadyComplete
    ) {
      return;
    }

    let active =
      true;

    async function recover() {
      const searchParams =
        new URLSearchParams(
          window.location.search,
        );

      const paymentReturn =
        searchParams.get(
          "payment",
        );

      if (
        paymentReturn ===
        "stripe-return"
      ) {
        setProvider(
          "stripe",
        );

        setProviderMessage(
          "Confirming your Stripe payment...",
        );

        beginPolling();

        return;
      }

      try {
        const state =
          await checkPaymentStatus();

        if (!active) {
          return;
        }

        if (
          paymentReturn ===
          "stripe-cancelled"
        ) {
          if (
            state !==
            "succeeded"
          ) {
            setProvider(
              "stripe",
            );

            setBrowserStripeCancelled(
              true,
            );

            setFinalOutcome(
              "cancelled",
            );

            setProviderMessage(
              "Stripe Checkout was closed before DriveCo received payment confirmation.",
            );

            clearPaymentQuery();
          }

          return;
        }

        if (
          state ===
          "pending"
        ) {
          beginPolling();
        }
      } catch (statusError) {
        if (!active) {
          return;
        }

        setError(
          statusError instanceof Error
            ? statusError.message
            : "Payment status could not be checked.",
        );
      }
    }

    void recover();

    return () => {
      active =
        false;
    };
  }, [
    alreadyComplete,
    checkPaymentStatus,
    isExternalMode,
  ]);

  /* ---------------------------------------
     Initiate / Resume Payment
  --------------------------------------- */

  async function requestPayment(
    selectedProvider:
      PaymentProvider,

    consentAccepted:
      boolean,
  ) {
    if (
      !consentAccepted ||
      !canInteract
    ) {
      return;
    }

    if (
      isExternalMode &&
      selectedProvider ===
        "mpesa" &&
      !phoneNumber.trim()
    ) {
      setError(
        "Enter the M-Pesa phone number that should receive the payment prompt.",
      );

      return;
    }

    setBusy(
      true,
    );

    setError(
      null,
    );

    setFinalOutcome(
      null,
    );

    setBrowserStripeCancelled(
      false,
    );

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

                provider:
                  selectedProvider,

                serviceConsent:
                  true,

                ...(isExternalMode &&
                selectedProvider ===
                  "mpesa"
                  ? {
                      phoneNumber:
                        phoneNumber.trim(),
                    }
                  : {}),
              }),
          },
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        if (
          result.code ===
            "PAYMENT_ALREADY_PENDING" &&
          result.activeProvider
        ) {
          setProvider(
            result.activeProvider,
          );
        }

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

      if (
        result.payment
      ) {
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

        setProvider(
          result.payment.provider,
        );
      }

      /* ---------------------------------
         Mock
      --------------------------------- */

      if (
        paymentMode ===
        "mock"
      ) {
        return;
      }

      /* ---------------------------------
         M-Pesa
      --------------------------------- */

      if (
        selectedProvider ===
        "mpesa"
      ) {
        setProviderMessage(
          result.mpesa
            ?.message ??
            "Check your phone and complete the M-Pesa payment prompt.",
        );

        beginPolling();

        return;
      }

      /* ---------------------------------
         Stripe
      --------------------------------- */

      const checkoutUrl =
        result.stripe
          ?.checkoutUrl;

      if (
        !checkoutUrl
      ) {
        throw new Error(
          "Stripe Checkout could not be opened.",
        );
      }

      setProviderMessage(
        "Opening secure Stripe Checkout...",
      );

      window.location.assign(
        checkoutUrl,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The payment could not be started.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function initiatePayment() {
    if (
      !provider ||
      !consent
    ) {
      return;
    }

    await requestPayment(
      provider,
      consent,
    );
  }

  async function resumeStripeCheckout() {
    setProvider(
      "stripe",
    );

    await requestPayment(
      "stripe",
      true,
    );
  }

  /* ---------------------------------------
     Manual Status Check
  --------------------------------------- */

  async function manuallyCheckStatus() {
    setBusy(
      true,
    );

    setError(
      null,
    );

    try {
      const state =
        await checkPaymentStatus();

      if (
        state ===
        "pending"
      ) {
        setProviderMessage(
          "Payment is still awaiting provider confirmation.",
        );
      }
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Payment status could not be checked.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  /* ---------------------------------------
     Mock Completion
  --------------------------------------- */

  async function completeMockPayment(
    outcome:
      PaymentOutcome,
  ) {
    if (!payment) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      null,
    );

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
      setBusy(
        false,
      );
    }
  }

  function resetAttempt() {
    setPolling(
      false,
    );

    setPayment(
      null,
    );

    setFinalOutcome(
      null,
    );

    setProvider(
      null,
    );

    setConsent(
      false,
    );

    setPhoneNumber(
      "",
    );

    setProviderMessage(
      null,
    );

    setError(
      null,
    );

    setBrowserStripeCancelled(
      false,
    );
  }

  /* ---------------------------------------
     Already Paid
  --------------------------------------- */

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
          DriveCo has received
          provider confirmation for
          the application distribution
          service. Your driver profile
          can now proceed to the
          distribution stage.
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

  const externalPaymentPending =
    isExternalMode &&
    payment !==
      null &&
    [
      "created",
      "pending",
    ].includes(
      payment.status,
    ) &&
    !finalOutcome;

  const missingMpesaPhone =
    isExternalMode &&
    provider ===
      "mpesa" &&
    !phoneNumber.trim();

  return (
    <>
      {/* ---------------------------------
          New Payment Selection
      --------------------------------- */}

      {!payment &&
        !finalOutcome && (
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
                  busy
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
                KSh 200 and that
                payment does not
                guarantee an
                interview, job offer
                or employment.
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
                  busy
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
                  Mobile STK payment
                  prompt
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
                  busy
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
                  Secure hosted
                  checkout
                </small>
              </button>
            </div>

            {isExternalMode &&
              provider ===
                "mpesa" && (
                <div
                  className={
                    styles.mockMessage
                  }
                >
                  <strong>
                    M-Pesa number
                  </strong>

                  <p>
                    Enter the Kenyan
                    Safaricom number
                    that should receive
                    the STK payment
                    prompt.
                  </p>

                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="07XXXXXXXX or 2547XXXXXXXX"
                    value={
                      phoneNumber
                    }
                    disabled={
                      busy
                    }
                    onChange={(
                      event,
                    ) =>
                      setPhoneNumber(
                        event.target
                          .value,
                      )
                    }
                    style={{
                      width:
                        "100%",

                      marginTop:
                        "14px",

                      minHeight:
                        "48px",

                      border:
                        "1px solid #deded8",

                      background:
                        "#faf9f6",

                      padding:
                        "0 14px",

                      color:
                        "#161616",

                      font:
                        "inherit",
                    }}
                  />
                </div>
              )}

            {paymentMode ===
              "mock" && (
              <div
                className={
                  styles.mockMessage
                }
              >
                <strong>
                  Mock payment mode
                </strong>

                <p>
                  No real money will
                  move. Choose a
                  provider to simulate
                  the payment flow.
                </p>
              </div>
            )}

            {paymentMode ===
              "sandbox" && (
              <div
                className={
                  styles.mockMessage
                }
              >
                <strong>
                  Payment sandbox
                </strong>

                <p>
                  DriveCo is connected
                  to provider testing
                  environments. No
                  commercial payment
                  should be collected
                  in this mode.
                </p>
              </div>
            )}

            {paymentMode ===
              "live" && (
              <div
                className={
                  styles.notice
                }
              >
                <strong>
                  Secure payment
                </strong>

                <p>
                  Choose your payment
                  method to continue.
                </p>
              </div>
            )}
          </>
        )}

      {/* ---------------------------------
          Errors
      --------------------------------- */}

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

      {/* ---------------------------------
          External Provider Pending
      --------------------------------- */}

      {externalPaymentPending && (
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
            Payment pending
          </p>

          <h3>
            {payment.provider ===
            "mpesa"
              ? "Check your phone"
              : "Stripe Checkout is awaiting completion"}
          </h3>

          <p>
            Provider:{" "}
            <strong>
              {
                providerName(
                  payment.provider,
                )
              }
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

          {providerMessage && (
            <p>
              {
                providerMessage
              }
            </p>
          )}

          {polling && (
            <p>
              DriveCo is checking for
              provider confirmation...
            </p>
          )}

          <div
            className={
              styles.mockActions
            }
          >
            {payment.provider ===
              "stripe" && (
              <button
                type="button"
                disabled={
                  busy
                }
                onClick={
                  resumeStripeCheckout
                }
              >
                Resume Stripe Checkout
              </button>
            )}

            <button
              type="button"
              disabled={
                busy
              }
              onClick={
                manuallyCheckStatus
              }
            >
              Check payment status
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------
          Mock Provider Console
      --------------------------------- */}

      {isMockMode &&
        payment &&
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
                {
                  providerName(
                    payment.provider,
                  )
                }
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

      {/* ---------------------------------
          Failure
      --------------------------------- */}

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
            No successful payment was
            recorded. You may start a
            new payment attempt.
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

      {/* ---------------------------------
          Cancelled
      --------------------------------- */}

      {finalOutcome ===
        "cancelled" && (
        <div
          className={
            styles.paymentResult
          }
        >
          <strong>
            {browserStripeCancelled
              ? "Stripe Checkout was not completed."
              : "Payment cancelled."}
          </strong>

          <p>
            {browserStripeCancelled
              ? "DriveCo has not received successful payment confirmation. The existing Stripe session may still be resumed."
              : "No successful payment was recorded. You may start another payment attempt."}
          </p>

          {browserStripeCancelled ? (
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
                onClick={
                  resumeStripeCheckout
                }
              >
                Return to Stripe Checkout
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={
                  manuallyCheckStatus
                }
              >
                Check payment status
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={
                resetAttempt
              }
            >
              Start another attempt
            </button>
          )}
        </div>
      )}

      {/* ---------------------------------
          Main Actions
      --------------------------------- */}

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
                missingMpesaPhone ||
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
                : provider ===
                    "mpesa" &&
                  isExternalMode
                ? "Send M-Pesa prompt"
                : provider ===
                      "stripe" &&
                    isExternalMode
                  ? "Continue to Stripe"
                  : "Proceed to payment"}
            </button>
          </div>
        )}
    </>
  );
}