import type {
  Metadata,
} from "next";

import Link from "next/link";

import {
  SITE_CONFIG,
} from "@/lib/site-config";

import styles from "../legal.module.css";

export const metadata:
  Metadata = {
  title:
    "Terms of Use | DriveCo",

  description:
    "Terms governing use of DriveCo driver application and placement services.",
};

export default function TermsPage() {
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
          {
            SITE_CONFIG.brandName
          }
        </Link>

        <header
          className={
            styles.header
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            Terms
          </p>

          <h1>
            Terms of Use
          </h1>

          <p
            className={
              styles.updated
            }
          >
            Effective{" "}
            {
              SITE_CONFIG.privacyEffectiveDate
            }
          </p>

          <p
            className={
              styles.intro
            }
          >
            These terms explain the
            conditions for submitting
            a driver application and
            using services made
            available through DriveCo.
          </p>
        </header>

        <div
          className={
            styles.content
          }
        >
          <section
            className={
              styles.section
            }
          >
            <h2>
              1. About DriveCo
            </h2>

            <p>
              DriveCo provides a
              platform through which
              drivers can submit
              applications and may,
              where available, choose
              additional services
              intended to help
              distribute their
              profiles to potential
              employer partners.
            </p>

            <p>
              DriveCo is operated by:
            </p>

            <p
              className={
                styles.placeholder
              }
            >
              {
                SITE_CONFIG.operatorName
              }
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              2. Driver applications
              are free
            </h2>

            <p>
              Submitting a standard
              driver application to
              DriveCo is free.
            </p>

            <p>
              DriveCo does not require
              payment merely to submit
              the application form.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              3. Optional placement
              or distribution
              services
            </h2>

            <p>
              DriveCo may separately
              offer an optional
              application distribution
              or placement-support
              service.
            </p>

            <p>
              Where such a paid service
              is available, its price,
              description and relevant
              payment conditions will
              be displayed separately
              before payment.
            </p>

            <p>
              Paying for a distribution
              or placement-support
              service does not
              guarantee:
            </p>

            <ul>
              <li>
                an interview;
              </li>

              <li>
                selection by an
                employer;
              </li>

              <li>
                a job offer; or
              </li>

              <li>
                employment.
              </li>
            </ul>

            <div
              className={
                styles.notice
              }
            >
              <strong>
                Current staging status
              </strong>

              <p>
                Paid placement services
                are currently in
                technical testing and
                are not available for
                purchase while payment
                processing is disabled.
              </p>
            </div>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              4. Accurate information
            </h2>

            <p>
              Applicants must provide
              information that is
              accurate and not
              deliberately misleading.
            </p>

            <p>
              You should not submit
              forged, altered, stolen
              or fraudulent
              identification,
              licences, certificates
              or employment
              documents.
            </p>

            <p>
              DriveCo may decline,
              suspend or remove
              applications where there
              is reasonable evidence of
              fraud, misuse or serious
              inaccuracy.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              5. Driver eligibility
            </h2>

            <p>
              Applicants are
              responsible for ensuring
              that they are legally
              entitled to hold or use
              the driving credentials
              they submit and are
              eligible for the type of
              work they seek.
            </p>

            <p>
              DriveCo&apos;s acceptance
              of an application is not
              a certification that an
              applicant satisfies every
              requirement imposed by a
              particular employer or
              regulator.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              6. Employer decisions
            </h2>

            <p>
              Employers and recruitment
              partners remain
              responsible for their
              own hiring decisions,
              interviews, background
              checks, licence
              verification, employment
              terms and regulatory
              requirements.
            </p>

            <p>
              DriveCo does not control
              or guarantee a third
              party&apos;s recruitment
              decision.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              7. Payments and refunds
            </h2>

            <p>
              Real payment processing
              is currently disabled.
            </p>

            <p>
              Before DriveCo enables
              paid services
              commercially, the
              applicable payment,
              cancellation and refund
              conditions will be
              displayed before a user
              authorizes payment.
            </p>

            <p>
              DriveCo will not treat a
              payment as successful
              solely because a browser
              is redirected to a
              success screen. Payment
              confirmation will depend
              on confirmation from the
              applicable payment
              provider.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              8. Acceptable use
            </h2>

            <p>
              You must not:
            </p>

            <ul>
              <li>
                attempt to bypass
                platform security;
              </li>

              <li>
                submit automated,
                fraudulent or abusive
                applications;
              </li>

              <li>
                upload malware or
                harmful files;
              </li>

              <li>
                impersonate another
                person; or
              </li>

              <li>
                use DriveCo for
                unlawful purposes.
              </li>
            </ul>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              9. Service
              availability
            </h2>

            <p>
              DriveCo may modify,
              suspend or temporarily
              disable parts of the
              platform for security,
              maintenance, testing,
              compliance or technical
              reasons.
            </p>

            <p>
              Features described as
              testing, preview or
              unavailable should not
              be treated as active
              commercial services.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              10. Privacy
            </h2>

            <p>
              Our handling of personal
              information is described
              in the{" "}
              <Link href="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              11. Liability
            </h2>

            <p>
              DriveCo aims to operate
              the platform with
              reasonable care and
              security.
            </p>

            <p>
              To the extent permitted
              by applicable law,
              DriveCo is not
              responsible for hiring
              decisions made by third
              parties or for
              representations made
              independently by
              employers, applicants or
              other third parties.
            </p>

            <p>
              Nothing in these terms
              excludes rights or
              liabilities that cannot
              lawfully be excluded.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              12. Governing law
            </h2>

            <p>
              These terms are intended
              to be governed by the
              laws of Kenya, subject to
              any mandatory legal
              rights or requirements
              that apply.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              13. Contact
            </h2>

            <p>
              Questions about these
              terms may be sent to:
            </p>

            <p
              className={
                styles.placeholder
              }
            >
              {
                SITE_CONFIG.contactEmail
              }
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              14. Changes
            </h2>

            <p>
              DriveCo may update these
              terms where its services
              or legal requirements
              change. The effective
              date at the top of this
              page will be updated when
              material changes are
              made.
            </p>
          </section>
        </div>

        <footer
          className={
            styles.footer
          }
        >
          <span>
            © DriveCo
          </span>

          <div
            className={
              styles.footerLinks
            }
          >
            <Link href="/">
              Home
            </Link>

            <Link href="/privacy">
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}