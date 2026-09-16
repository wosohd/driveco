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
    "Privacy Policy | DriveCo",

  description:
    "DriveCo Privacy Policy for driver applications and related services.",
};

export default function PrivacyPage() {
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
            Privacy
          </p>

          <h1>
            Privacy Policy
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
            DriveCo respects the
            privacy of drivers who
            apply through our
            platform. This policy
            explains what information
            we collect, why we use it,
            how it may be shared, and
            the choices and rights
            available to applicants.
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
              1. Who is responsible
              for your information?
            </h2>

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

            <p>
              Business address:
            </p>

            <p
              className={
                styles.placeholder
              }
            >
              {
                SITE_CONFIG.businessAddress
              }
            </p>

            <p>
              Contact:
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
              2. Information we
              collect
            </h2>

            <p>
              Depending on the
              application and services
              you use, DriveCo may
              collect:
            </p>

            <ul>
              <li>
                your name, email
                address, telephone or
                WhatsApp number,
                nationality and
                country;
              </li>

              <li>
                national identification
                information;
              </li>

              <li>
                driving licence number,
                category and driving
                experience;
              </li>

              <li>
                education,
                employment status,
                previous employment
                information and
                availability;
              </li>

              <li>
                copies or images of
                your National ID,
                driving licence, CV
                and, where provided,
                profile photograph;
              </li>

              <li>
                application reference,
                application status and
                service records; and
              </li>

              <li>
                limited technical and
                security information
                needed to protect the
                platform from abuse.
              </li>
            </ul>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              3. Why we use your
              information
            </h2>

            <p>
              We process applicant
              information where
              necessary to:
            </p>

            <ul>
              <li>
                receive and manage your
                driver application;
              </li>

              <li>
                verify or review
                information and
                documents you provide;
              </li>

              <li>
                communicate with you
                about your application;
              </li>

              <li>
                match or distribute
                your profile to
                potential employer
                partners where you
                have chosen or
                authorized that
                service;
              </li>

              <li>
                maintain application
                records and prevent
                duplicate or abusive
                submissions;
              </li>

              <li>
                protect DriveCo,
                applicants and partner
                organizations from
                fraud, misuse and
                security threats; and
              </li>

              <li>
                comply with applicable
                legal and regulatory
                requirements.
              </li>
            </ul>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              4. Legal basis and
              consent
            </h2>

            <p>
              Depending on the
              activity, DriveCo may
              process personal data
              based on your consent,
              steps you have requested
              in connection with a
              service, legitimate
              operational interests,
              or legal obligations.
            </p>

            <p>
              Where DriveCo relies on
              consent, you may withdraw
              that consent subject to
              applicable law and any
              processing already
              lawfully completed.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              5. Who we may share
              information with
            </h2>

            <p>
              We do not sell driver
              personal information.
            </p>

            <p>
              Information may be
              disclosed only where
              appropriate to:
            </p>

            <ul>
              <li>
                potential employer or
                recruitment partners
                where distribution of
                your application has
                been authorized;
              </li>

              <li>
                technology providers
                that help us host,
                secure, store or
                operate the platform;
              </li>

              <li>
                payment providers if
                paid services are
                activated and you
                choose to use them;
                and
              </li>

              <li>
                government,
                regulatory,
                law-enforcement or
                legal authorities where
                disclosure is required
                by law.
              </li>
            </ul>

            <p>
              DriveCo currently uses
              infrastructure and
              security services that
              may include Supabase,
              Vercel and Cloudflare.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              6. Driver documents
              and security
            </h2>

            <p>
              Driver documents are
              intended to be stored in
              private storage rather
              than publicly accessible
              folders. DriveCo uses
              controls including
              restricted database
              access, private storage,
              signed upload
              authorization, request
              validation, rate
              limiting and bot
              protection.
            </p>

            <p>
              No internet service can
              guarantee absolute
              security. DriveCo will
              continue reviewing and
              improving its technical
              and organizational
              safeguards.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              7. International
              processing
            </h2>

            <p>
              Some technology service
              providers used by
              DriveCo may process or
              store information outside
              Kenya.
            </p>

            <p>
              Where personal data is
              transferred outside
              Kenya, DriveCo will seek
              to use appropriate
              safeguards and comply
              with applicable
              requirements concerning
              cross-border transfers.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              8. How long we keep
              information
            </h2>

            <p>
              DriveCo retains personal
              information only for as
              long as reasonably
              necessary for the
              purposes for which it was
              collected, including
              application management,
              authorized distribution,
              record keeping, security,
              dispute resolution and
              legal obligations.
            </p>

            <p>
              Information that is no
              longer required should be
              deleted, anonymized or
              securely disposed of in
              accordance with
              DriveCo&apos;s retention
              practices.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              9. Your privacy rights
            </h2>

            <p>
              Subject to applicable
              Kenyan law, you may have
              rights to:
            </p>

            <ul>
              <li>
                be informed how your
                personal information
                is used;
              </li>

              <li>
                request access to
                personal information
                held about you;
              </li>

              <li>
                object to certain
                processing;
              </li>

              <li>
                request correction of
                inaccurate or
                misleading
                information; and
              </li>

              <li>
                request deletion where
                the applicable legal
                requirements are met.
              </li>
            </ul>

            <p>
              Requests should be sent
              to:
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
              10. Complaints
            </h2>

            <p>
              If you have a privacy
              concern, please contact
              DriveCo first so that we
              can review it.
            </p>

            <p>
              You may also have the
              right to raise a concern
              with Kenya&apos;s Office
              of the Data Protection
              Commissioner.
            </p>
          </section>

          <section
            className={
              styles.section
            }
          >
            <h2>
              11. Changes to this
              policy
            </h2>

            <p>
              DriveCo may update this
              policy when its services,
              technology or legal
              obligations change.
              Material updates will be
              reflected by changing
              the effective date shown
              above.
            </p>
          </section>

          <div
            className={
              styles.notice
            }
          >
            <strong>
              Pre-launch notice
            </strong>

            <p>
              DriveCo is currently in
              technical testing.
              Business identity and
              contact placeholders on
              this page must be
              completed before public
              commercial launch.
            </p>
          </div>
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

            <Link href="/terms">
              Terms
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}