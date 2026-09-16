import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  verifyTurnstileToken,
} from "@/lib/turnstile/server";

const TURNSTILE_HEADER =
  "x-turnstile-token";

function getRequestHostname(
  request: NextRequest,
) {
  return request.nextUrl.hostname
    .trim()
    .toLowerCase();
}

export default async function proxy(
  request: NextRequest,
) {
  /*
   * Only protect actual application
   * creation.
   *
   * GET/OPTIONS/etc. continue normally.
   */
  if (
    request.method !==
    "POST"
  ) {
    return NextResponse.next();
  }

  const token =
    request.headers.get(
      TURNSTILE_HEADER,
    );

  if (!token) {
    return NextResponse.json(
      {
        ok: false,

        code:
          "TURNSTILE_REQUIRED",

        message:
          "Security verification is required before submitting an application.",
      },
      {
        status: 403,
      },
    );
  }

  const hostname =
    getRequestHostname(
      request,
    );

  const verification =
    await verifyTurnstileToken(
      token,
      hostname,
    );

  if (!verification.ok) {
    /*
     * Do not expose Cloudflare's
     * internal validation details to
     * the browser.
     */

    if (
      verification.reason ===
      "configuration" ||
      verification.reason ===
      "siteverify-unavailable"
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "SECURITY_SERVICE_UNAVAILABLE",

          message:
            "Security verification is temporarily unavailable. Please try again.",
        },
        {
          status: 503,
        },
      );
    }

    return NextResponse.json(
      {
        ok: false,

        code:
          "TURNSTILE_FAILED",

        message:
          "Security verification could not be completed. Please try again.",
      },
      {
        status: 403,
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/applications",
  ],
};