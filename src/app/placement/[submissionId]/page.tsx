import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import PaymentPanel from "@/components/payment-panel";

import {
  PLACEMENT_SERVICE,
  paymentMode,
} from "@/lib/payments/config";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

import styles from "./placement.module.css";

export const dynamic =
  "force-dynamic";

type PlacementPageProps = {
  params: Promise<{
    submissionId: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlacementPage({
  params,
}: PlacementPageProps) {
  const {
    submissionId,
  } = await params;

  const normalizedSubmissionId =
    submissionId
      .trim()
      .toLowerCase();

  if (
    !UUID_PATTERN.test(
      normalizedSubmissionId,
    )
  ) {
    notFound();
  }

  /* ---------------------------------------
     Application
  --------------------------------------- */

  const {
    data: applications,
    error:
      applicationError,
  } =
    await supabaseAdmin
      .from(
        "applications",
      )
      .select(
        `
          id,
          submission_id,
          application_reference,
          status
        `,
      )
      .eq(
        "submission_id",
        normalizedSubmissionId,
      )
      .limit(1);

  if (
    applicationError
  ) {
    console.error(
      "Placement application lookup failed.",
    );

    throw new Error(
      "The application could not be loaded.",
    );
  }

  const application =
    applications?.[0];

  if (!application) {
    notFound();
  }

  /* ---------------------------------------
     Existing Placement Status
  --------------------------------------- */

  const {
    data:
      placementRequest,

    error:
      placementError,
  } =
    await supabaseAdmin
      .from(
        "placement_requests",
      )
      .select(
        `
          id,
          status
        `,
      )
      .eq(
        "application_id",
        application.id,
      )
      .maybeSingle();

  if (
    placementError
  ) {
    console.error(
      "Placement request lookup failed.",
    );

    throw new Error(
      "The placement service could not be loaded.",
    );
  }

  const paymentsDisabled =
    paymentMode ===
    "disabled";

  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.container
        }
      >
        <Link
          href="/"
          className={
            styles.brand
          }
        >
          DriveCo
        </Link>

        <section
          className={
            styles.confirmation
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            Application received
          </p>

          <h1>
            Your driver application
            is complete.
          </h1>

          <p
            className={
              styles.reference
            }
          >
            Application reference
          </p>

          <strong
            className={
              styles.referenceValue
            }
          >
            {
              application.application_reference
            }
          </strong>

          <p
            className={
              styles.freeNotice
            }
          >
            Your DriveCo driver
            application was submitted
            free of charge.
          </p>
        </section>

        {paymentsDisabled ? (
          <section
            className={
              styles.service
            }
          >
            <p
              className={
                styles.serviceEyebrow
              }
            >
              Placement services
            </p>

            <h2>
              Application distribution
              services are currently
              in testing.
            </h2>

            <p
              className={
                styles.description
              }
            >
              DriveCo is currently
              testing its driver
              placement and application
              distribution systems.
              These services are not
              currently available for
              purchase through this
              website.
            </p>

            <div
              className={
                styles.notice
              }
            >
              <strong>
                No payment required
              </strong>

              <p>
                Your driver application
                has already been
                received free of
                charge. Do not send
                payment to anyone
                claiming that payment
                is required to complete
                this application.
              </p>
            </div>

            <div
              className={
                styles.actions
              }
            >
              <Link
                href="/"
                className={
                  styles.secondaryAction
                }
              >
                Return to DriveCo
              </Link>

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    "18px",

                  flexWrap:
                    "wrap",
                }}
              >
                <Link
                  href="/privacy"
                  className={
                    styles.secondaryAction
                  }
                >
                  Privacy
                </Link>

                <Link
                  href="/terms"
                  className={
                    styles.secondaryAction
                  }
                >
                  Terms
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section
            className={
              styles.service
            }
          >
            <div
              className={
                styles.serviceHeader
              }
            >
              <div>
                <p
                  className={
                    styles.serviceEyebrow
                  }
                >
                  Optional placement
                  service
                </p>

                <h2>
                  {
                    PLACEMENT_SERVICE.name
                  }
                </h2>
              </div>

              <div
                className={
                  styles.price
                }
              >
                <span>
                  KSh
                </span>

                <strong>
                  {
                    PLACEMENT_SERVICE.amountKes
                  }
                </strong>
              </div>
            </div>

            <p
              className={
                styles.description
              }
            >
              You may choose
              DriveCo&apos;s
              application distribution
              service to have your
              driver profile submitted
              to suitable partner
              companies currently
              working with DriveCo.
            </p>

            <div
              className={
                styles.notice
              }
            >
              <strong>
                Important
              </strong>

              <p>
                The KSh 200 charge is
                for DriveCo&apos;s
                application
                distribution service.
                It is not an
                application fee and
                payment does not
                guarantee an interview,
                job offer or
                employment.
              </p>
            </div>

            <PaymentPanel
              submissionId={
                normalizedSubmissionId
              }
              paymentMode={
                paymentMode
              }
              initialPlacementStatus={
                placementRequest?.status ??
                null
              }
            />
          </section>
        )}
      </div>
    </main>
  );
}