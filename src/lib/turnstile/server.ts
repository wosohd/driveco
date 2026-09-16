import "server-only";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TURNSTILE_ACTION =
  "driver_application";

type TurnstileSiteverifyResponse = {
  success: boolean;

  challenge_ts?: string;

  hostname?: string;

  action?: string;

  "error-codes"?: string[];
};

export type TurnstileVerificationResult =
  | {
      ok: true;

      hostname: string;
    }
  | {
      ok: false;

      reason:
        | "configuration"
        | "invalid-token"
        | "siteverify-unavailable"
        | "verification-failed"
        | "hostname-mismatch"
        | "action-mismatch";

      errorCodes?: string[];
    };

function normalizeHostname(
  hostname: string,
) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

export async function verifyTurnstileToken(
  token: string,
  expectedHostname: string,
): Promise<TurnstileVerificationResult> {
  const secretKey =
    process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error(
      "Turnstile verification failed: missing server secret.",
    );

    return {
      ok: false,
      reason:
        "configuration",
    };
  }

  if (
    !token ||
    token.length > 2048
  ) {
    return {
      ok: false,
      reason:
        "invalid-token",
    };
  }

  const body =
    new URLSearchParams({
      secret:
        secretKey,

      response:
        token,
    });

  let response: Response;

  try {
    response =
      await fetch(
        TURNSTILE_SITEVERIFY_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body,

          cache:
            "no-store",

          signal:
            AbortSignal.timeout(
              10_000,
            ),
        },
      );
  } catch {
    console.error(
      "Turnstile Siteverify request failed.",
    );

    return {
      ok: false,
      reason:
        "siteverify-unavailable",
    };
  }

  if (!response.ok) {
    console.error(
      "Turnstile Siteverify returned a non-success HTTP response.",
    );

    return {
      ok: false,
      reason:
        "siteverify-unavailable",
    };
  }

  let result:
    TurnstileSiteverifyResponse;

  try {
    result =
      (await response.json()) as
        TurnstileSiteverifyResponse;
  } catch {
    console.error(
      "Turnstile Siteverify returned invalid JSON.",
    );

    return {
      ok: false,
      reason:
        "siteverify-unavailable",
    };
  }

  if (!result.success) {
    return {
      ok: false,
      reason:
        "verification-failed",

      errorCodes:
        result[
          "error-codes"
        ] ?? [],
    };
  }

  if (
    result.action !==
    TURNSTILE_ACTION
  ) {
    return {
      ok: false,
      reason:
        "action-mismatch",
    };
  }

  const verifiedHostname =
    normalizeHostname(
      result.hostname ?? "",
    );

  const requiredHostname =
    normalizeHostname(
      expectedHostname,
    );

  if (
    !verifiedHostname ||
    verifiedHostname !==
      requiredHostname
  ) {
    return {
      ok: false,
      reason:
        "hostname-mismatch",
    };
  }

  return {
    ok: true,

    hostname:
      verifiedHostname,
  };
}

export {
  TURNSTILE_ACTION,
};